'use client';

import { createTheme } from '@mui/material/styles';

/**
 * Beaver admin theme — the MUI (Berry/Toolpad-style) dashboard look, mapped to
 * Beaver's brand tokens (green #039855 + slate + white, General Sans UI with
 * tabular numerals for money, JetBrains Mono for IDs/receipts).
 * Used only by the platform-admin console (`/admin`).
 */
export const adminTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      50: '#ecfdf3',
      100: '#d1fadf',
      200: '#a6f4c5',
      600: '#039855',
      700: '#027a48',
      800: '#05603a',
      main: '#039855',
      dark: '#027a48',
      contrastText: '#fff',
    },
    background: {
      default: '#fbfcfd',
      paper: '#ffffff',
    },
    divider: '#eef1f4',
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"General Sans", system-ui, -apple-system, sans-serif',
    h1: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#fff', color: '#0f172a', boxShadow: 'none', borderBottom: '1px solid #eef1f4' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid #eef1f4', width: 264 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 10, minHeight: 44 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', fullWidth: true },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

/** Shared DataGrid chrome (v9 has no MuiDataGrid theme key — apply via sx). */
export const dataGridSx = {
  border: '1px solid #eef1f4',
  borderRadius: 3,
  backgroundColor: '#fff',
  fontFamily: '"General Sans", system-ui, sans-serif',
  '& .MuiDataGrid-columnHeaders': { backgroundColor: '#fbfcfd' },
  '& .MuiDataGrid-cell': { py: 1 },
  '& .MuiDataGrid-cell:focus': { outline: 'none' },
  '& .MuiDataGrid-columnHeader:focus': { outline: 'none' },
};

export const ADMIN_DRAWER_WIDTH = 264;
