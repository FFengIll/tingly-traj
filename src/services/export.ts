// Export service for downloading session data
export async function exportSession(sessionId: string, project: string): Promise<void> {
  const url = `/api/sessions/${sessionId}/export?project=${encodeURIComponent(project)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;

    // Filename: sessionId-timestamp.jsonl
    const timestamp = new Date().toISOString().split('T')[0];
    a.download = `${sessionId}-${timestamp}.jsonl`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}
