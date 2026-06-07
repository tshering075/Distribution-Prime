import React, { useEffect, useMemo } from "react";
import { Box, Typography, Button, Paper, Stack } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { getOrderShippingInvoices } from "../utils/orderStatus";
import {
  openShippingInvoice,
  downloadShippingInvoice,
  createInvoicePreviewUrl,
  invoiceIsPdf,
} from "../utils/shippingInvoiceActions";

/**
 * Shipping invoice attachment(s) for distributors (and optional reuse elsewhere).
 */
export default function ShippingInvoiceAttachment({
  order,
  title = "Shipping invoice",
  showInlinePreview = true,
}) {
  const invoices = getOrderShippingInvoices(order);
  const hasData = invoices.length > 0;
  const primary = invoices[0];
  // `primary` is derived from `order` and is often a new object reference each render.
  // For PDFs, changing the blob URL forces the iframe to reload (visible as flicker).
  // Use a stable identity key instead of object reference equality.
  const primaryKey = primary
    ? `${primary.fileName || ""}|${primary.mimeType || ""}|${String(primary.data || "").length}`
    : "";

  const preview = useMemo(
    () =>
      hasData && showInlinePreview && primary
        ? createInvoicePreviewUrl(primary)
        : { url: null, revoke: () => {} },
    // primaryKey avoids re-creating blob URLs when `primary` is a new object reference with the same content
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable key; see primaryKey above
    [hasData, showInlinePreview, primaryKey]
  );

  useEffect(() => () => preview.revoke(), [preview]);

  if (!hasData) return null;

  const isPdf = primary && invoiceIsPdf(primary);

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 2,
        p: 2,
        borderRadius: 2,
        bgcolor: "action.hover",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <AttachFileIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {title}
          {invoices.length > 1 ? ` (${invoices.length} files)` : ""}
        </Typography>
      </Box>
      {invoices.length === 1 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {primary.fileName || "invoice"}
          {isPdf ? " (PDF)" : ""}
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          {invoices.map((inv, idx) => (
            <Stack
              key={`${inv.fileName}_${idx}`}
              direction="row"
              flexWrap="wrap"
              gap={1}
              alignItems="center"
              sx={{ py: 0.5 }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 120 }}>
                {inv.fileName || `File ${idx + 1}`}
                {invoiceIsPdf(inv) ? " (PDF)" : ""}
              </Typography>
              <Button
                size="small"
                variant="text"
                startIcon={<VisibilityIcon />}
                onClick={() => openShippingInvoice(inv)}
              >
                Open
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<DownloadIcon />}
                onClick={() => downloadShippingInvoice(inv)}
              >
                Download
              </Button>
            </Stack>
          ))}
        </Stack>
      )}
      {invoices.length === 1 ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={() => openShippingInvoice(primary)}
          >
            Open in new tab
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadShippingInvoice(primary)}
          >
            Download
          </Button>
        </Box>
      ) : null}
      {showInlinePreview && preview.url && invoices.length === 1 ? (
        isPdf ? (
          <Box
            component="iframe"
            title="Shipping invoice preview"
            src={preview.url}
            sx={{
              mt: 2,
              width: "100%",
              height: { xs: 320, sm: 420 },
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.paper",
            }}
          />
        ) : (
          <Box
            component="img"
            src={preview.url}
            alt="Shipping invoice"
            sx={{
              mt: 2,
              maxWidth: "100%",
              maxHeight: 420,
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              display: "block",
            }}
          />
        )
      ) : null}
    </Paper>
  );
}
