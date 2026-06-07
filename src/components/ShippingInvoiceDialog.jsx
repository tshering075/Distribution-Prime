import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ShippingInvoiceAttachment from "./ShippingInvoiceAttachment";
import { getOrderShippingInvoices, orderHasShippingInvoice } from "../utils/orderStatus";

/**
 * Standalone dialog for distributors to view/download shipping invoice.
 */
export default function ShippingInvoiceDialog({ open, onClose, order, orderLabel }) {
  const label = orderLabel || order?.orderNumber || "Order";
  const hasInvoice = orderHasShippingInvoice(order);
  const fileCount = getOrderShippingInvoices(order).length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: "primary.main",
          color: "primary.contrastText",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Shipping {fileCount > 1 ? "invoices" : "invoice"} — {label}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: "inherit" }} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {hasInvoice ? (
          <ShippingInvoiceAttachment order={order} title="Document from shipping" />
        ) : (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No shipping invoice is attached to this order yet. After shipping uploads an invoice and
            marks the order dispatched, refresh the Orders list and try again.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
