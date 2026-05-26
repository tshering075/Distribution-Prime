import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Serialize error for better logging
    const serializeError = (err) => {
      if (!err) return 'Unknown error';
      if (typeof err === 'string') return err;
      if (err.message) return err.message;
      if (err.toString && err.toString() !== '[object Object]') return err.toString();
      try {
        return JSON.stringify(err, Object.getOwnPropertyNames(err));
      } catch {
        return String(err);
      }
    };
    
    const errorMessage = serializeError(error);
    console.error('ErrorBoundary caught an error:', errorMessage, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Helper function to serialize error objects
      const serializeError = (err) => {
        if (!err) return 'Unknown error';
        if (typeof err === 'string') return err;
        if (err.message) return err.message;
        if (err.error_description) return err.error_description;
        if (err.error) return err.error;
        if (err.toString && err.toString() !== '[object Object]') return err.toString();
        try {
          return JSON.stringify(err, Object.getOwnPropertyNames(err));
        } catch (e) {
          return String(err) || 'An unexpected error occurred';
        }
      };
      
      // Extract error message from various error object formats
      const errorMessage = serializeError(this.state.error);
      
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            bgcolor: '#f5f5f5',
            p: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 600,
              textAlign: 'center'
            }}
          >
            <Typography variant="h5" color="error" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, mb: 3, color: '#666' }}>
              {errorMessage}
            </Typography>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: '#f5f5f5',
                  borderRadius: 1,
                  textAlign: 'left',
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              >
                <Typography variant="caption" component="pre" sx={{ fontSize: '0.75rem' }}>
                  {this.state.errorInfo.componentStack}
                </Typography>
              </Box>
            )}
            <Button
              variant="contained"
              color="primary"
              onClick={this.handleReset}
              sx={{ mt: 3 }}
            >
              Reload Page
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
