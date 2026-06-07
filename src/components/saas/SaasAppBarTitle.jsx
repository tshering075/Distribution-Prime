import React from "react";
import { Box, Typography } from "@mui/material";
import { saasAppBarTitleBlockSx, saasAppBarTitleSx, saasAppBarSubtitleSx } from "../../theme/saasChrome";

/**
 * Consistent title + subtitle block for dashboard app bars.
 */
export default function SaasAppBarTitle({ title, subtitle }) {
  return (
    <Box sx={saasAppBarTitleBlockSx()}>
      <Typography variant="h6" component="div" noWrap sx={saasAppBarTitleSx()}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" component="div" noWrap sx={saasAppBarSubtitleSx()}>
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}
