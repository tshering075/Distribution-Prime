import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";

export default function LogoutConfirmDialog({ open, onClose, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="logout-dialog-title"
      aria-describedby="logout-dialog-description"
    >
      <DialogTitle id="logout-dialog-title" sx={{ fontWeight: 700 }}>
        Logout
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="logout-dialog-description">
          Are you sure you want to log out?
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          No
        </Button>
        <Button onClick={onConfirm} variant="contained" color="primary" autoFocus>
          Yes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function useLogoutConfirmation(onLogout) {
  const [open, setOpen] = useState(false);

  const requestLogout = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleConfirm = useCallback(() => {
    setOpen(false);
    if (typeof onLogout === "function") onLogout();
  }, [onLogout]);

  const logoutConfirmDialog = (
    <LogoutConfirmDialog open={open} onClose={handleClose} onConfirm={handleConfirm} />
  );

  return { requestLogout, logoutConfirmDialog };
}
