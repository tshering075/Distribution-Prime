import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { getOrderShippingInvoices } from "../utils/orderStatus";
import {
  appendShippingInvoices,
  MAX_SHIPPING_INVOICE_FILES,
  removeShippingInvoiceAtIndex,
} from "../utils/shippingInvoiceStorage";
import { readShippingInvoiceFiles } from "../utils/shippingInvoiceFile";

export default function ShippingInvoiceEditDialog({
  open,
  order,
  orderLabel,
  busy = false,
  onClose,
  onSave,
}) {
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && order) {
      setDraft(getOrderShippingInvoices(order));
      setError("");
      setConfirmRemoveAll(false);
    }
  }, [open, order]);

  const snapshotInputFiles = (input) => {
    const files = Array.from(input?.files ?? []);
    if (input) input.value = "";
    return files;
  };

  const handleAddFiles = async (picked) => {
    const files = Array.from(picked ?? []).filter(Boolean);
    if (!files.length) return;
    setError("");
    try {
      const parsed = await readShippingInvoiceFiles(files);
      setDraft((prev) => appendShippingInvoices(prev, parsed));
    } catch (e) {
      if (e?.partialResults?.length) {
        setDraft((prev) => appendShippingInvoices(prev, e.partialResults));
        setError(e.message);
      } else {
        setError(e?.message || "Could not read selected files");
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setError(e?.message || "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAll = () => {
    setDraft([]);
    setConfirmRemoveAll(false);
  };

  const disabled = busy || saving;

  return (
    <Dialog open={open} onClose={disabled ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Edit invoice files</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Order <strong>{orderLabel || "—"}</strong>. Remove wrong files, add replacements, or clear all
          invoices. Save when finished.
        </DialogContentText>

        {error ? (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        ) : null}

        {confirmRemoveAll ? (
          <Alert
            severity="error"
            sx={{ mb: 2, borderRadius: 2 }}
            action={
              <Stack direction="row" spacing={0.5}>
                <Button size="small" color="inherit" onClick={() => setConfirmRemoveAll(false)}>
                  Cancel
                </Button>
                <Button size="small" color="error" variant="contained" onClick={handleRemoveAll}>
                  Remove all
                </Button>
              </Stack>
            }
          >
            Remove every invoice file on this order? You can upload new files afterward.
          </Alert>
        ) : null}

        {draft.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            No invoice files on this order. Add files below, then save.
          </Alert>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {draft.map((inv, idx) => (
              <Stack
                key={`${inv.fileName}_${idx}`}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ py: 0.75, px: 1, borderRadius: 1, bgcolor: "action.hover" }}
              >
                <Box sx={{ minWidth: 0, pr: 1 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {inv.fileName || `File ${idx + 1}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {inv.mimeType || "file"}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  color="error"
                  aria-label={`Remove ${inv.fileName}`}
                  disabled={disabled}
                  onClick={() => setDraft((prev) => removeShippingInvoiceAtIndex(prev, idx))}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.pdf,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const files = snapshotInputFiles(e.target);
            if (files.length) void handleAddFiles(files);
          }}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            disabled={disabled || draft.length >= MAX_SHIPPING_INVOICE_FILES}
            onClick={() => fileInputRef.current?.click()}
            sx={{ fontWeight: 700, textTransform: "none" }}
          >
            Add files
          </Button>
          {draft.length > 0 ? (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepIcon />}
              disabled={disabled}
              onClick={() => setConfirmRemoveAll(true)}
              sx={{ fontWeight: 700, textTransform: "none" }}
            >
              Remove all
            </Button>
          ) : null}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
          PNG, JPG, or PDF — up to {MAX_SHIPPING_INVOICE_FILES} files, 5 MB each
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={disabled}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ fontWeight: 800 }}
        >
          Save changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
