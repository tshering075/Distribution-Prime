import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import { orderToHTML } from "../services/emailService";

function OrderPreviewDialog({ open, order, onClose }) {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Generate PNG when order changes
  useEffect(() => {
    if (open && order) {
      generateOrderImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order]);

  const generateOrderImage = async () => {
    if (!order) return;

    // Prefer distributor-submitted PNG from calculator, if available.
    if (order.tableImageData) {
      setImageData(order.tableImageData);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Create a temporary div with order details
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '20px';
      tempDiv.style.backgroundColor = '#fff';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      
      const htmlContent = orderToHTML(order);
      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);
      
      // Convert to canvas using html2canvas
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      });
      
      // Remove temp div
      document.body.removeChild(tempDiv);
      
      // Convert canvas to PNG data URL
      const imageDataUrl = canvas.toDataURL('image/png');
      setImageData(imageDataUrl);
    } catch (error) {
      console.error('Error generating order image:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageData) return;
    
    const link = document.createElement('a');
    link.download = `Order_${order.distributorName || 'Distributor'}_${new Date(order.timestamp).toISOString().split('T')[0]}.png`;
    link.href = imageData;
    link.click();
  };

  if (!order) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">
            Order Preview - {order.distributorName || order.distributorCode || "Unknown"}
          </Typography>
          <Box>
            {imageData && (
              <IconButton onClick={handleDownload} color="primary" sx={{ mr: 1 }}>
                <DownloadIcon />
              </IconButton>
            )}
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Generating preview...
            </Typography>
          </Box>
        ) : imageData ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <img
              src={imageData}
              alt="Order Preview"
              style={{
                maxWidth: "100%",
                height: "auto",
                border: "1px solid #ddd",
                borderRadius: "4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}
            />
          </Box>
        ) : (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" sx={{ color: "#999" }}>
              Unable to generate preview
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {imageData && (
          <Button onClick={handleDownload} variant="contained" startIcon={<DownloadIcon />}>
            Download PNG
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default OrderPreviewDialog;
