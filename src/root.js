// src/Root.js
import App from './App';
import '@fontsource/roboto';
import { AppThemeProvider } from './theme/AppThemeProvider';

function Root() {
  return (
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  );
}

export default Root;
