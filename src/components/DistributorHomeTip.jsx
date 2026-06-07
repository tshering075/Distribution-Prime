import React from "react";
import { Alert, Box, Button, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import CalculateIcon from "@mui/icons-material/Calculate";
import ListAltIcon from "@mui/icons-material/ListAlt";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import {
  dismissDistributorHomeTip,
  isDistributorHomeTipDismissed,
} from "../utils/distributorOnboarding";

const STEPS = [
  {
    icon: CalculateIcon,
    title: "Place Order",
    body: "Use the center button to open the calculator and submit your order to head office.",
  },
  {
    icon: ListAltIcon,
    title: "Orders",
    body: "Track pending, approved, and rejected orders. Tap a row to see your calculated table.",
  },
  {
    icon: LocalShippingIcon,
    title: "Shipping invoices",
    body: "When an order is dispatched, open Orders and use View or Download in the invoice column (multiple files supported).",
  },
];

/**
 * One-time dismissible guide on the distributor home screen.
 */
export default function DistributorHomeTip({ distributorCode, onOpenOrders, onPlaceOrder }) {
  const [dismissed, setDismissed] = React.useState(() =>
    isDistributorHomeTipDismissed(distributorCode)
  );

  React.useEffect(() => {
    setDismissed(isDistributorHomeTipDismissed(distributorCode));
  }, [distributorCode]);

  if (dismissed || !distributorCode) return null;

  const handleDismiss = () => {
    dismissDistributorHomeTip(distributorCode);
    setDismissed(true);
  };

  return (
    <Alert
      severity="info"
      icon={false}
      variant="outlined"
      sx={{
        mb: 2.5,
        borderRadius: 3,
        alignItems: "flex-start",
        bgcolor: (t) => alpha(t.palette.info.main, t.palette.mode === "dark" ? 0.12 : 0.06),
        borderColor: (t) => alpha(t.palette.info.main, 0.35),
        "& .MuiAlert-message": { width: "100%", p: 0 },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
            Quick start
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
            Three steps to get the most from your dashboard:
          </Typography>
          <Stack spacing={1.25}>
            {STEPS.map(({ icon: Icon, title, body }) => (
              <Stack key={title} direction="row" spacing={1.25} alignItems="flex-start">
                <Box
                  sx={{
                    mt: 0.25,
                    p: 0.75,
                    borderRadius: 1.5,
                    bgcolor: "action.selected",
                    display: "flex",
                  }}
                >
                  <Icon fontSize="small" color="primary" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                    {body}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
            {typeof onPlaceOrder === "function" ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<CalculateIcon />}
                onClick={onPlaceOrder}
                sx={{ fontWeight: 700, textTransform: "none" }}
              >
                Place order
              </Button>
            ) : null}
            {typeof onOpenOrders === "function" ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ListAltIcon />}
                onClick={onOpenOrders}
                sx={{ fontWeight: 700, textTransform: "none" }}
              >
                View orders
              </Button>
            ) : null}
            <Button
              size="small"
              color="inherit"
              onClick={handleDismiss}
              sx={{ fontWeight: 600, textTransform: "none", ml: { sm: "auto" } }}
            >
              Got it, hide this
            </Button>
          </Stack>
        </Box>
        <IconButton size="small" aria-label="dismiss quick start" onClick={handleDismiss} sx={{ mt: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Alert>
  );
}
