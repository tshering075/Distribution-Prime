import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Stack,
  Box,
  Alert,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { useOrganization } from '../context/OrganizationProvider';
import { markOnboardingDone } from '../utils/onboarding';
import { PLATFORM_NAME } from '../constants/saas';

const STEPS = ['Welcome', 'Your workspace', 'Connect Gmail', 'Get started'];

export default function OnboardingWizardDialog({
  open,
  onClose,
  onOpenWorkspaceSettings,
  onOpenDistributors,
  onOpenRateMaster,
  ownerEmail = '',
  initialStep = 0,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { organization } = useOrganization();
  const [activeStep, setActiveStep] = useState(initialStep);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailError, setGmailError] = useState('');

  useEffect(() => {
    if (open) setActiveStep(initialStep);
  }, [open, initialStep]);

  const finish = () => {
    if (organization?.id) markOnboardingDone(organization.id);
    onClose();
  };

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    setGmailError('');
    try {
      const { connectGmailAsAdmin, isGmailConfigured } = await import('../services/gmailService');
      if (!(await isGmailConfigured())) {
        throw new Error(
          'Gmail API is not configured yet. Your platform operator must save Gmail credentials in the Platform console.'
        );
      }
      const connected = await connectGmailAsAdmin(ownerEmail);
      if (!connected) {
        throw new Error('Gmail authorization completed but the account could not be verified.');
      }
      setGmailEmail(connected);
      setGmailConnected(true);
    } catch (err) {
      setGmailError(err?.message || 'Failed to connect Gmail');
    } finally {
      setGmailConnecting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={finish}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ fontWeight: 900 }}>
        Welcome to {PLATFORM_NAME}
      </DialogTitle>
      <DialogContent>
        <Stepper
          activeStep={activeStep}
          orientation={isMobile ? 'vertical' : 'horizontal'}
          sx={{ mb: 3 }}
        >
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Stack spacing={2}>
            <Typography>
              You created an isolated workspace for your company. Data here is separate from every
              other customer on {PLATFORM_NAME}.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You can connect Gmail in the next step to send order emails from your admin account.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Invite your team anytime from the admin sidebar.
            </Typography>
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={2}>
            <Typography fontWeight={700}>Workspace details</Typography>
            <Box sx={{ pl: 0.5 }}>
              <Typography variant="body2">
                <strong>Name:</strong> {organization?.name}
              </Typography>
              <Typography variant="body2">
                <strong>Workspace ID:</strong> {organization?.slug}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Share the workspace ID with distributors and staff when they sign in.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={onOpenWorkspaceSettings}>
              Customize branding
            </Button>
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2}>
            <Typography fontWeight={700}>Connect Gmail for order emails</Typography>
            <Typography variant="body2" color="text.secondary">
              Authorize {ownerEmail ? <strong>{ownerEmail}</strong> : 'your admin account'} with Google so you can send
              order emails from this workspace.
            </Typography>
            {gmailConnected ? (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                Gmail connected as <strong>{gmailEmail}</strong>.
              </Alert>
            ) : (
              <>
                {gmailError ? <Alert severity="error">{gmailError}</Alert> : null}
                <Button
                  variant="contained"
                  startIcon={gmailConnecting ? <CircularProgress size={18} color="inherit" /> : <MailOutlineIcon />}
                  disabled={gmailConnecting}
                  onClick={handleConnectGmail}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {gmailConnecting ? 'Authorizing…' : 'Authorize Gmail'}
                </Button>
              </>
            )}
          </Stack>
        )}

        {activeStep === 3 && (
          <Stack spacing={1.5}>
            <Typography fontWeight={700}>Recommended setup</Typography>
            {[
              { label: 'Add distributors', action: onOpenDistributors },
              { label: 'Set product rates', action: onOpenRateMaster },
            ].map((item) => (
              <Button
                key={item.label}
                variant="text"
                startIcon={<CheckCircleOutlineIcon />}
                onClick={item.action}
                sx={{ justifyContent: 'flex-start', fontWeight: 700 }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {activeStep > 0 ? (
          <Button onClick={() => setActiveStep((s) => s - 1)}>Back</Button>
        ) : (
          <Button onClick={finish}>Skip</Button>
        )}
        {activeStep < STEPS.length - 1 ? (
          <Button variant="contained" onClick={() => setActiveStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="contained" onClick={finish}>
            Go to dashboard
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
