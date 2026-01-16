import { createTheme } from '@mui/material/styles';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0d0d0d',
      paper: '#1a1a1a',
    },
    primary: {
      main: '#7c3aed',
      light: '#8b5cf6',
    },
    divider: '#333',
    text: {
      primary: '#fff',
      secondary: '#ccc',
      disabled: '#888',
    },
    success: {
      main: '#22c55e',
    },
    info: {
      main: '#3b82f6',
    },
    error: {
      main: '#f87171',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            borderRadius: 6,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
  },
});

export default darkTheme;
