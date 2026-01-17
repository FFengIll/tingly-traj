#!/usr/bin/env python3
"""
Claude Code Q&A Trajectory Extractor

This tool extracts complete question-answer trajectories from Claude Code JSONL log files.
A trajectory is defined as all messages starting from a valid user message and continuing
until the next valid user message or end of file.

Valid user messages exclude:
- Messages with isMeta=true (system-generated metadata)
- Messages with tool_use_id
- Session summary messages (appear mid-trajectory)
- Messages containing only system-generated content (images, files, etc.)

Usage:
    extract_traj_for_cc <query_string> <path>

Example:
    extract_traj_for_cc "Summarize the architecture" tmp/
"""

from __future__ import annotations

import json
import re
import sys
from enum import Enum
from pathlib import Path
from typing import Any, List, Optional

import typer

app = typer.Typer(
    name="extract_traj_for_cc",
    help="Extract Claude Code Q&A trajectories from JSONL log files",
    add_completion=False,
)


class MatchMode(str, Enum):
    """Query matching modes"""
    substring = "substring"
    regex = "regex"
    exact = "exact"


class OutputFormat(str, Enum):
    """Output format options"""
    json = "json"
    jsonl = "jsonl"
    text = "text"


# Error messages
ERR_NO_MATCH = "No matching trajectory found"
ERR_INVALID_PATH = "Invalid path: {path}"
ERR_NO_JSONL_FILES = "No JSONL files found in {path}"


def find_jsonl_files(path: Path, recursive: bool = True) -> List[Path]:
    """Find all JSONL files in the given path.

    Skips macOS AppleDouble files (starting with ._) and other system files.

    Args:
        path: Path to file or directory
        recursive: Whether to search recursively (for directories)

    Returns:
        List of JSONL file paths
    """
    if path.is_file():
        if path.suffix == ".jsonl":
            return [path]
        else:
            typer.echo(f"Error: File is not a .jsonl file: {path}", err=True)
            raise typer.Exit(1)

    if not path.is_dir():
        typer.echo(f"Error: {ERR_INVALID_PATH.format(path=path)}", err=True)
        raise typer.Exit(1)

    if recursive:
        files = list(path.rglob("*.jsonl"))
    else:
        files = list(path.glob("*.jsonl"))

    # Filter out macOS AppleDouble files and other system files
    def should_skip(file_path: Path) -> bool:
        """Return True if file should be skipped"""
        name = file_path.name
        # Skip macOS resource fork files
        if name.startswith("._"):
            return True
        # Skip macOS DS_Store files
        if name == ".DS_Store":
            return True
        # Skip Thumbs.db (Windows)
        if name == "Thumbs.db":
            return True
        # Skip desktop.ini (Windows)
        if name.lower() == "desktop.ini":
            return True
        return False

    files = [f for f in files if not should_skip(f)]

    if not files:
        typer.echo(f"Error: {ERR_NO_JSONL_FILES.format(path=path)}", err=True)
        raise typer.Exit(1)

    return sorted(files)


def parse_jsonl_line(line: str) -> Optional[dict[str, Any]]:
    """Parse a single JSONL line.

    Args:
        line: A single line from a JSONL file

    Returns:
        Parsed JSON object or None if parsing fails
    """
    try:
        return json.loads(line.strip())
    except json.JSONDecodeError:
        return None


def is_valid_first_message(msg: dict[str, Any]) -> bool:
    """Check if a message is a valid trajectory start (user message).

    Args:
        msg: Parsed JSON message object

    Returns:
        True if message is a valid user message
    """
    if msg.get("type") != "user":
        return False

    message_content = msg.get("message", {})
    if not isinstance(message_content, dict):
        return False

    return message_content.get("role") == "user"


def extract_message_content(msg: dict[str, Any]) -> str:
    """Extract the content field from a message.

    Args:
        msg: Parsed JSON message object

    Returns:
        String representation of message content
    """
    message = msg.get("message", {})
    content = message.get("content", "")

    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        # Handle content blocks (e.g., text + images)
        text_parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))
        return " ".join(text_parts)
    else:
        return str(content)


def match_query(
    content: str,
    query: str,
    mode: MatchMode,
    ignore_case: bool = True
) -> bool:
    """Check if content matches the query based on the specified mode.

    Supports UTF-8 characters properly using casefold() for case-insensitive matching.

    Args:
        content: Message content to search in
        query: Query string to match
        mode: Matching mode (substring, regex, exact)
        ignore_case: Whether to ignore case when matching

    Returns:
        True if content matches the query
    """
    if ignore_case:
        # Use casefold() for proper UTF-8 case-insensitive comparison
        # casefold() handles more languages than lower()
        content = content.casefold()
        query = query.casefold()

    if mode == MatchMode.substring:
        return query in content
    elif mode == MatchMode.regex:
        try:
            # For regex, if ignore_case is True, use re.IGNORECASE
            # re.IGNORECASE with UNICODE flag (default in Python 3) handles UTF-8 properly
            flags = re.IGNORECASE if ignore_case else 0
            # re.UNICODE is default in Python 3, ensuring proper UTF-8 handling
            return re.search(query, content, flags) is not None
        except re.error:
            typer.echo(f"Error: Invalid regex pattern: {query}", err=True)
            raise typer.Exit(1)
    elif mode == MatchMode.exact:
        return content == query
    else:
        return False


def is_user_message(msg: dict[str, Any]) -> bool:
    """Check if a message is a user message that can start a trajectory.

    A user message is considered a trajectory start point iff:
    - type is "user"
    - isMeta is not true (filter out metadata/system messages)
    - message.content doesn't contain a non-empty tool_use_id field
    - message.content is not empty
    - is not a session summary message (session summaries appear mid-trajectory)

    Args:
        msg: Parsed JSON message object

    Returns:
        True if message is a valid user message without tool_use_id
    """
    if msg.get("type") != "user":
        return False

    # Filter out meta messages (system-generated messages like image placeholders)
    if msg.get("isMeta", False):
        return False

    # Filter out session summary messages (they appear mid-trajectory, not as boundaries)
    if is_session_summary_message(msg):
        return False

    message_content = msg.get("message", {})
    if not isinstance(message_content, dict):
        return False

    content = message_content.get("content", {})

    # Check if content is empty
    content_text = extract_message_content(msg).strip()
    if not content_text:
        return False

    # Check if content has tool_use_id field (can be a dict or list)
    tool_use_id = None
    if isinstance(content, dict):
        tool_use_id = content.get("tool_use_id")
    elif isinstance(content, list):
        # Content blocks may have tool_use_id
        for block in content:
            if isinstance(block, dict):
                tool_use_id = block.get("tool_use_id")
                if tool_use_id:
                    break

    # Return True only if no tool_use_id or tool_use_id is empty
    return not tool_use_id


def segment_trajectories(messages: List[dict[str, Any]]) -> List[List[dict[str, Any]]]:
    """Segment messages into trajectories.

    A trajectory is defined as all messages starting from a valid user message
    and continuing until the next valid user message or end of file.

    A valid user message:
    - Has type "user"
    - isMeta is not true (filters out metadata/system messages)
    - Doesn't have tool_use_id
    - Has non-empty content
    - Is not a session summary message

    User messages that don't meet these criteria (with tool_use_id, isMeta=true,
    empty content, or session summaries) are NOT trajectory boundaries and are included as regular
    messages in the current trajectory.

    Args:
        messages: List of parsed JSON messages

    Returns:
        List of trajectories, where each trajectory is a list of messages
        starting with a valid user message.
    """
    trajectories: List[List[dict[str, Any]]] = []
    current: List[dict[str, Any]] = []

    for msg in messages:
        if is_user_message(msg):
            # End current trajectory and start a new one
            if current:
                trajectories.append(current)
            current = [msg]
        else:
            # Add to current trajectory if we have started one
            if current:
                current.append(msg)

    # Add the last trajectory if it exists
    if current:
        trajectories.append(current)

    return trajectories


def contains_error(msg: dict[str, Any]) -> bool:
    """Check if a message contains error indicators (excluding interruptions).

    Args:
        msg: Parsed JSON message object

    Returns:
        True if message contains error indicators
    """
    content = extract_message_content(msg).casefold()

    # Check for error patterns (excluding user interruptions)
    error_indicators = [
        "api error",
        "adapter_disabled",
        "format adaptation is disabled",
    ]

    # Also check for "error:" but not when part of interruption messages
    if "error:" in content and "interrupted" not in content:
        return True

    for indicator in error_indicators:
        if indicator in content:
            return True

    return False


def trajectory_has_errors(trajectory: List[dict[str, Any]]) -> bool:
    """Check if any message in the trajectory contains errors.

    Args:
        trajectory: List of messages in the trajectory

    Returns:
        True if trajectory contains error messages
    """
    for msg in trajectory:
        if contains_error(msg):
            return True
    return False


def trajectory_was_interrupted(trajectory: List[dict[str, Any]]) -> bool:
    """Check if the trajectory was interrupted by the user.

    Args:
        trajectory: List of messages in the trajectory

    Returns:
        True if trajectory contains interruption indicators
    """
    for msg in trajectory:
        content = extract_message_content(msg).casefold()
        if "interrupted by user" in content or "request interrupted" in content:
            return True
    return False


def is_session_summary_message(msg: dict[str, Any]) -> bool:
    """Check if a message is a session summary message.

    Session summary messages should NOT be treated as trajectory boundaries.
    They typically appear in the middle of a trajectory (system-generated context).

    Session summary traits:
    1. More than 300 words
    2. Contains "This session is being continued from a previous conversation"

    Args:
        msg: Parsed JSON message object

    Returns:
        True if message is a session summary (should not start a trajectory)
    """
    content = extract_message_content(msg)

    # Check for session continuation indicator
    continuation_patterns = [
        "this session is being continued from a previous conversation",
        "session continued from previous conversation",
        "continuing from previous conversation",
        "continued from:",
        "previous session:",
    ]

    content_lower = content.casefold()
    has_continuation_indicator = any(pattern in content_lower for pattern in continuation_patterns)

    # Count words (split by whitespace)
    word_count = len(content.split())

    # A message is considered a session summary if:
    # - It has continuation indicator AND is more than 300 words
    # OR
    # - It's extremely long (more than 500 words) even without explicit indicator
    if has_continuation_indicator:
        return word_count > 300

    return word_count > 500


def select_best_trajectory(
    trajectories: List[List[dict[str, Any]]],
    verbose: bool = True
) -> Optional[List[dict[str, Any]]]:
    """Select the best trajectory from multiple candidates.

    Selection algorithm:
    1. Discard trajectories with error messages
    2. Discard interrupted trajectories
    3. Select the trajectory with the most messages

    Note: Session summary messages are filtered out during trajectory segmentation
    (see is_user_message), so they don't appear as trajectory boundaries.

    If all trajectories are discarded, select the longest one from all original trajectories.

    Args:
        trajectories: List of candidate trajectories
        verbose: Whether to output selection details

    Returns:
        The best trajectory, or None if input is empty
    """
    if not trajectories:
        return None

    if len(trajectories) == 1:
        if verbose:
            typer.echo(f"Found 1 trajectory")
        return trajectories[0]

    if verbose:
        typer.echo(f"Found {len(trajectories)} trajectories")

    # Step 1: Filter out trajectories with errors
    valid_trajectories = []
    errors_discarded = 0

    for traj in trajectories:
        if trajectory_has_errors(traj):
            errors_discarded += 1
            if verbose:
                typer.echo(f"  - Discarded trajectory: contains API error or error indicators", err=True)
        else:
            valid_trajectories.append(traj)

    if verbose and errors_discarded > 0:
        typer.echo(f"Discarded {errors_discarded} trajectory(s) with errors", err=True)

    # Step 3: Filter out interrupted trajectories
    remaining_trajectories = []
    interrupted_discarded = 0

    for traj in valid_trajectories:
        if trajectory_was_interrupted(traj):
            interrupted_discarded += 1
            if verbose:
                typer.echo(f"  - Discarded trajectory: interrupted by user", err=True)
        else:
            remaining_trajectories.append(traj)

    if verbose and interrupted_discarded > 0:
        typer.echo(f"Discarded {interrupted_discarded} interrupted trajectory(s)", err=True)

    # Step 4: Select trajectory with the most messages
    if not remaining_trajectories:
        # All trajectories were discarded, select the longest from all original trajectories
        if verbose:
            typer.echo("Warning: All trajectories were discarded, selecting longest from all", err=True)
        trajectories.sort(key=len, reverse=True)
        best = trajectories[0]
        if verbose:
            typer.echo(f"Selected trajectory with {len(best)} messages (longest among all)", err=True)
        return best

    # Sort by message count (descending) and select the first
    remaining_trajectories.sort(key=len, reverse=True)
    best = remaining_trajectories[0]

    if verbose and len(remaining_trajectories) > 1:
        typer.echo(f"Selected trajectory with {len(best)} messages (largest)", err=True)

    return best


def extract_trajectories(
    file_path: Path,
    query: str,
    mode: MatchMode = MatchMode.substring,
    ignore_case: bool = True,
    find_all: bool = False
) -> List[List[dict[str, Any]]]:
    """Extract trajectories from a file that match the given query.

    Args:
        file_path: Path to JSONL file
        query: Query string to match against first user message
        mode: Query matching mode
        ignore_case: Whether to ignore case when matching
        find_all: If True, return all matches; otherwise return only first

    Returns:
        List of matching trajectories
    """
    matching_trajectories: List[List[dict[str, Any]]] = []

    # Skip macOS AppleDouble files (start with ._)
    if file_path.name.startswith("._"):
        return matching_trajectories

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            messages: List[dict[str, Any]] = []
            for line_num, line in enumerate(f, 1):
                try:
                    line = line.strip()
                    if not line:
                        continue

                    msg = parse_jsonl_line(line)
                    if msg is not None:
                        messages.append(msg)
                except json.JSONDecodeError:
                    # Skip malformed JSON lines silently
                    continue
                except Exception:
                    # Skip any other errors per line
                    continue

            # Segment into trajectories
            trajectories = segment_trajectories(messages)

            # Find matching trajectories
            for trajectory in trajectories:
                if not trajectory:
                    continue

                # Validate first message is a user message
                if not is_valid_first_message(trajectory[0]):
                    continue

                # Check if query matches first user message content
                content = extract_message_content(trajectory[0])
                if match_query(content, query, mode, ignore_case):
                    matching_trajectories.append(trajectory)

                    if not find_all:
                        break

    except FileNotFoundError:
        typer.echo(f"Error: File not found: {file_path}", err=True)
        raise typer.Exit(1)
    except PermissionError:
        typer.echo(f"Error: Permission denied: {file_path}", err=True)
        raise typer.Exit(1)
    except UnicodeDecodeError as e:
        # File is not valid UTF-8 (likely a binary file)
        typer.echo(f"Warning: Skipping non-UTF-8 file (likely binary): {file_path.name}", err=True)
        return matching_trajectories
    except Exception as e:
        typer.echo(f"Warning: Error reading file {file_path.name}: {e}", err=True)
        return matching_trajectories

    return matching_trajectories


def format_output(
    trajectories: List[List[dict[str, Any]]],
    format_type: OutputFormat
) -> str:
    """Format trajectories for output.

    Args:
        trajectories: List of trajectories to format
        format_type: Output format type

    Returns:
        Formatted output string
    """
    if format_type == OutputFormat.json:
        # Output as JSON array
        return json.dumps(trajectories, indent=2, ensure_ascii=False)

    elif format_type == OutputFormat.jsonl:
        # Output as JSONL (one JSON object per line)
        lines: List[str] = []
        for trajectory in trajectories:
            for msg in trajectory:
                lines.append(json.dumps(msg, ensure_ascii=False))
        return "\n".join(lines)

    else:  # text format
        # Human-readable text format
        output: List[str] = []
        for i, trajectory in enumerate(trajectories):
            output.append(f"=== Trajectory {i + 1} ===")
            output.append(f"Messages: {len(trajectory)}")
            output.append("")

            for msg in trajectory:
                msg_type = msg.get("type", "unknown")
                output.append(f"[{msg_type}]")

                if "message" in msg:
                    role = msg["message"].get("role", "")
                    content = extract_message_content(msg)
                    output.append(f"Role: {role}")
                    output.append(f"Content: {content[:200]}{'...' if len(content) > 200 else ''}")

                output.append("")

        return "\n".join(output)


@app.command()
def main(
    query_string: str = typer.Argument(
        ...,
        help="Query string to match against the first user message of a trajectory",
    ),
    path: str = typer.Argument(
        ...,
        help="Path to a JSONL file or directory containing JSONL files",
    ),
    recursive: bool = typer.Option(
        True,
        "--recursive/--no-recursive",
        "-r/-R",
        help="Search directories recursively (default: True)",
    ),
    mode: MatchMode = typer.Option(
        MatchMode.substring,
        "--mode",
        "-m",
        help="Query matching mode: substring, regex, or exact",
    ),
    ignore_case: bool = typer.Option(
        True,
        "--ignore-case/--case-sensitive",
        "-i/-c",
        help="Ignore case when matching (default: True)",
    ),
    find_all: bool = typer.Option(
        False,
        "--all",
        "-a",
        help="Find all matching trajectories instead of just the first",
    ),
    output_format: OutputFormat = typer.Option(
        OutputFormat.json,
        "--format",
        "-f",
        help="Output format: json, jsonl, or text",
    ),
    output_file: Optional[str] = typer.Option(
        None,
        "--output",
        "-o",
        help="Write output to file instead of stdout",
    ),
):
    """
    Extract Claude Code Q&A trajectories from JSONL log files.

    A trajectory consists of all messages from a valid user message until the next
    valid user message or end of file. Valid user messages exclude meta messages,
    tool use messages, session summaries, and system-generated content.

    Example:
        extract_traj_for_cc "Summarize the architecture" tmp/
    """
    # Resolve path
    input_path = Path(path).resolve()

    # Find JSONL files
    files = find_jsonl_files(input_path, recursive=recursive)

    # Extract trajectories
    all_matches: List[tuple[Path, List[dict[str, Any]]]] = []

    for file_path in files:
        trajectories = extract_trajectories(
            file_path,
            query_string,
            mode=mode,
            ignore_case=ignore_case,
            find_all=True  # Always find all to enable selection
        )

        for trajectory in trajectories:
            all_matches.append((file_path, trajectory))

        # Continue searching all files for more matches

    # Check if we found any matches
    if not all_matches:
        typer.echo(f"Error: {ERR_NO_MATCH}", err=True)
        raise typer.Exit(1)

    # Extract trajectories for processing
    trajectories_only = [traj for _, traj in all_matches]

    # Select best trajectory if not in "all" mode
    if not find_all:
        # Run selection first to show status messages before the output
        selected_trajectory = select_best_trajectory(trajectories_only, verbose=True)
        trajectories_to_output = [selected_trajectory] if selected_trajectory else trajectories_only
    else:
        trajectories_to_output = trajectories_only

    # Format output
    output = format_output(trajectories_to_output, output_format)

    # Add separator after verbose selection output
    if not find_all and len(trajectories_only) > 1 and not output_file:
        typer.echo("", err=True)

    # Write output
    if output_file:
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(output)
            typer.echo(f"Successfully extracted {len(trajectories_to_output)} trajectory(s) to {output_file}")
        except Exception as e:
            typer.echo(f"Error: Failed to write to {output_file}: {e}", err=True)
            raise typer.Exit(1)
    else:
        typer.echo(output)

    # Print file sources if multiple files were searched
    if len(files) > 1 and not find_all:
        # Find which file the selected trajectory came from
        selected_source = None
        if trajectories_to_output:
            for file_path, traj in all_matches:
                if traj is trajectories_to_output[0]:
                    selected_source = file_path
                    break
        if selected_source:
            typer.echo(f"\nFound in: {selected_source}", err=True)


if __name__ == "__main__":
    app()
