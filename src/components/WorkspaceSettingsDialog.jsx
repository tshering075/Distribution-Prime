import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Box,
  Paper,
  Chip,
  Divider,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import LinkIcon from '@mui/icons-material/Link';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useOrganization } from '../context/OrganizationProvider';
import {
  brandSettingsFromForm,
  isValidHexColor,
  logoSrcWithPublicUrl,
  resolveOrganizationBrand,
} from '../utils/organizationBrand';
import { APP_NAME, BRAND_MARK_SRC, BRAND_PRIMARY } from '../constants/brand';
import { PLATFORM_NAME } from '../constants/saas';
import AppSnackbar from './AppSnackbar';

const COLOR_PRESETS = [
  '#1565c0',
  '#0d47a1',
  '#2e7d32',
  '#6a1b9a',
  '#c62828',
  '#ef6c00',
  '#00838f',
  '#5d4037',
];

const publicUrl = process.env.PUBLIC_URL || '';

function copyText(text, onDone) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => onDone?.()).catch(() => onDone?.());
}

export default function WorkspaceSettingsDialog({ open, onClose }) {
  const { organization, brand, saveSettings } = useOrganization();
  const [form, setForm] = useState({
    appName: APP_NAME,
    markSrc: BRAND_MARK_SRC,
    primary: BRAND_PRIMARY,
    address: '',
    postNo: '',
    gstNo: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState('');

  const slug = organization?.slug || '';
  const loginPath = slug ? `/w/${slug}/login` : '/login';
  const loginUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${loginPath}` : loginPath;

  const previewBrand = useMemo(
    () =>
      resolveOrganizationBrand(
        {
          brand: {
            appName: form.appName,
            markSrc: form.markSrc,
            primary: form.primary,
          },
        },
        organization?.name
      ),
    [form, organization?.name]
  );

  const logoPreview = logoSrcWithPublicUrl(previewBrand.markSrc, publicUrl);
  const primaryValid = isValidHexColor(form.primary);

  useEffect(() => {
    if (!open) return;
    setForm({
      appName: brand.appName || organization?.name || APP_NAME,
      markSrc: brand.markSrc || BRAND_MARK_SRC,
      primary: brand.primary || BRAND_PRIMARY,
      address: brand.address || '',
      postNo: brand.postNo || '',
      gstNo: brand.gstNo || '',
    });
    setError('');
    setCopied('');
  }, [open, brand, organization?.name]);

  const handleCopy = (key, text) => {
    copyText(text, () => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const handleReset = () => {
    setForm({
      appName: organization?.name || APP_NAME,
      markSrc: BRAND_MARK_SRC,
      primary: BRAND_PRIMARY,
      address: '',
      postNo: '',
      gstNo: '',
    });
  };

  const handleSave = async () => {
    const name = form.appName.trim();
    if (!name) {
      setError('Display name is required');
      return;
    }
    if (!primaryValid) {
      setError('Enter a valid primary color (e.g. #1565c0)');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const nextBrand = {
        ...brand,
        appName: name,
        companyName: name,
        shortName: name.slice(0, 12) || brand.shortName,
        markSrc: form.markSrc.trim() || BRAND_MARK_SRC,
        primary: form.primary.trim(),
        address: form.address.trim(),
        postNo: form.postNo.trim(),
        gstNo: form.gstNo.trim(),
      };
      await saveSettings(brandSettingsFromForm(nextBrand));
      setSuccess('Workspace settings saved');
      onClose();
    } catch (e) {
      setError(e?.message || 'Failed to save workspace settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 2 },
            bgcolor: 'background.default',
            maxHeight: { xs: '100vh', sm: '92vh' },
          },
        }}
      >
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: previewBrand.primary }}>
          <Toolbar sx={{ gap: 1 }}>
            <BusinessOutlinedIcon />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Workspace settings
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Branding & sign-in details for your company
              </Typography>
            </Box>
            <IconButton color="inherit" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={2.5}>
            {/* Identity */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                Workspace identity
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                <Chip
                  size="small"
                  label={`ID: ${slug || '—'}`}
                  icon={<BusinessOutlinedIcon />}
                  variant="outlined"
                />
              </Stack>

              <Stack spacing={1} sx={{ mt: 2 }}>
                <TextField
                  size="small"
                  label="Workspace ID"
                  value={slug}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={copied === 'slug' ? 'Copied' : 'Copy ID'}>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => handleCopy('slug', slug)}
                            disabled={!slug}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Staff enter this on the login screen (cannot be changed here)"
                />
                <TextField
                  size="small"
                  label="Sign-in link"
                  value={loginUrl}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={copied === 'link' ? 'Copied' : 'Copy link'}>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => handleCopy('link', loginUrl)}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  helperText={`Share with admins and ${PLATFORM_NAME} users in this company`}
                />
              </Stack>
            </Paper>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
              {/* Form */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1, minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Branding
                </Typography>
                <Stack spacing={2} sx={{ mt: 1.5 }}>
                  <TextField
                    label="Display name"
                    value={form.appName}
                    onChange={(e) => setForm((f) => ({ ...f, appName: e.target.value }))}
                    fullWidth
                    size="small"
                    helperText="Shown in header, invoices, and distributor-facing screens"
                  />
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, pt: 0.5 }}>
                    Invoice letterhead
                  </Typography>
                  <TextField
                    label="Address"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    placeholder="Street, town, dzongkhag"
                    helperText="Centered at the top of shipping invoices"
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Post No."
                      value={form.postNo}
                      onChange={(e) => setForm((f) => ({ ...f, postNo: e.target.value }))}
                      fullWidth
                      size="small"
                      placeholder="e.g. 11001"
                    />
                    <TextField
                      label="GST No."
                      value={form.gstNo}
                      onChange={(e) => setForm((f) => ({ ...f, gstNo: e.target.value }))}
                      fullWidth
                      size="small"
                      placeholder="Organization GST number"
                    />
                  </Stack>
                  <TextField
                    label="Logo URL or path"
                    value={form.markSrc}
                    onChange={(e) => setForm((f) => ({ ...f, markSrc: e.target.value }))}
                    fullWidth
                    size="small"
                    placeholder="/distribution-prime-icon.svg"
                    helperText="Relative path in /public or full https:// URL"
                  />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75 }}>
                      Primary color
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <TextField
                        value={form.primary}
                        onChange={(e) => setForm((f) => ({ ...f, primary: e.target.value }))}
                        size="small"
                        placeholder="#1565c0"
                        error={!primaryValid && Boolean(form.primary)}
                        sx={{ width: 140 }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Box
                                sx={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 0.5,
                                  bgcolor: primaryValid ? form.primary : 'divider',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                }}
                              />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <input
                        type="color"
                        value={primaryValid ? form.primary : BRAND_PRIMARY}
                        onChange={(e) => setForm((f) => ({ ...f, primary: e.target.value }))}
                        style={{ width: 40, height: 36, padding: 0, border: 'none', cursor: 'pointer' }}
                        aria-label="Pick primary color"
                      />
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap">
                      {COLOR_PRESETS.map((c) => (
                        <Tooltip key={c} title={c}>
                          <Box
                            onClick={() => setForm((f) => ({ ...f, primary: c }))}
                            sx={{
                              width: 26,
                              height: 26,
                              borderRadius: 1,
                              bgcolor: c,
                              cursor: 'pointer',
                              border: form.primary === c ? '2px solid' : '1px solid',
                              borderColor: form.primary === c ? 'text.primary' : 'divider',
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </Paper>

              {/* Live preview */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  width: { xs: '100%', md: 280 },
                  flexShrink: 0,
                  bgcolor: alpha(previewBrand.primary, 0.04),
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <PaletteOutlinedIcon fontSize="small" color="action" />
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Live preview
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      bgcolor: previewBrand.primary,
                      color: 'primary.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    {logoPreview ? (
                      <Box
                        component="img"
                        src={logoPreview}
                        alt=""
                        sx={{ width: 28, height: 28, objectFit: 'contain' }}
                      />
                    ) : null}
                    <Typography variant="subtitle2" noWrap sx={{ fontWeight: 800, flex: 1 }}>
                      {previewBrand.appName}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    <Button
                      size="small"
                      variant="contained"
                      disableElevation
                      sx={{
                        bgcolor: previewBrand.primary,
                        textTransform: 'none',
                        fontWeight: 700,
                        mb: 1,
                        '&:hover': { bgcolor: previewBrand.primaryDark },
                      }}
                    >
                      Sample button
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      App bars and primary actions use this color after save.
                    </Typography>
                  </Box>
                </Box>

                {logoPreview ? (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      Logo
                    </Typography>
                    <Box
                      component="img"
                      src={logoPreview}
                      alt=""
                      sx={{ maxWidth: 120, maxHeight: 64, objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </Box>
                ) : null}
              </Paper>
            </Stack>
          </Stack>
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
          <Button startIcon={<RestartAltIcon />} onClick={handleReset} disabled={saving} color="inherit">
            Reset
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !primaryValid}>
            {saving ? 'Saving…' : 'Save branding'}
          </Button>
        </DialogActions>
      </Dialog>

      <AppSnackbar open={!!error} message={error} severity="error" onClose={() => setError('')} />
      <AppSnackbar open={!!success} message={success} severity="success" onClose={() => setSuccess('')} />
      <AppSnackbar
        open={!!copied}
        message={copied === 'slug' ? 'Workspace ID copied' : 'Sign-in link copied'}
        severity="info"
        onClose={() => setCopied('')}
      />
    </>
  );
}
