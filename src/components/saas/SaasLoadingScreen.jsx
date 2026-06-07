import React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useBrand } from "../../hooks/useBrand";
import { PLATFORM_NAME } from "../../constants/saas";
import { logoSrcWithPublicUrl } from "../../utils/organizationBrand";
import { saasPageBackdropSx } from "../../theme/saasChrome";
import { useTheme } from "@mui/material/styles";

/**
 * Full-screen loading state for lazy routes and auth bootstrap.
 */
export default function SaasLoadingScreen({ message = "Loading workspace…" }) {
  const theme = useTheme();
  const brand = useBrand();

  return (
    <Box
      sx={{
        ...saasPageBackdropSx(theme),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        p: 3,
      }}
    >
      <Box
        component="img"
        src={logoSrcWithPublicUrl(brand.markSrc)}
        alt={brand.appName || PLATFORM_NAME}
        sx={{ width: { xs: 120, sm: 160 }, height: "auto" }}
      />
      <CircularProgress size={36} thickness={4} />
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {message}
      </Typography>
    </Box>
  );
}
