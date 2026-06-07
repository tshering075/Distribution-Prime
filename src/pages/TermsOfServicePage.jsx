import React from "react";
import { Box, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import LegalPageLayout, { legalSx } from "../components/legal/LegalPageLayout";
import { PRIVACY_POLICY_PATH } from "../constants/brand";

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      footerLinks={
        <Typography variant="body2" component="p">
          <RouterLink to={PRIVACY_POLICY_PATH}>Privacy Policy</RouterLink>
          {" · "}
          <RouterLink to="/">Home</RouterLink>
          {" · "}
          <RouterLink to="/login">Sign in</RouterLink>
        </Typography>
      }
    >
      <Typography component="h1" variant="h4">
        Terms of Service
      </Typography>
      <Typography sx={legalSx.meta}>
        <strong>Distribution Prime</strong>
        <br />
        Effective date: March 24, 2025
      </Typography>

      <Typography component="p">
        These Terms of Service (“<strong>Terms</strong>”) govern your access to and use of the Distribution
        Prime web application (the “<strong>Service</strong>”). By accessing or using the Service, you agree to
        these Terms.
      </Typography>

      <Typography component="h2">1. Operator</Typography>
      <Typography component="p">
        The Service is provided by <strong>Distribution Prime</strong> (“<strong>we</strong>,” “
        <strong>us</strong>”). Contact: <strong>codewynbuild@gmail.com</strong>.
      </Typography>

      <Typography component="h2">2. Description of the Service</Typography>
      <Typography component="p">
        The Service provides tools for authorized users to manage distributor-related data, including targets,
        performance, orders, and related workflows. Features may include optional email sending and, when
        configured, integration with Google Gmail.
      </Typography>

      <Typography component="h2">3. Eligibility and accounts</Typography>
      <Box component="ul">
        <li>
          The Service is intended for authorized business users (for example, administrators and distributors
          invited or registered by your organization).
        </li>
        <li>You are responsible for maintaining the confidentiality of your credentials and for activity under your account.</li>
        <li>You must provide accurate information as required by your organization’s use of the Service.</li>
      </Box>

      <Typography component="h2">4. Acceptable use</Typography>
      <Typography component="p">You agree not to:</Typography>
      <Box component="ul">
        <li>Use the Service in violation of applicable law or third-party rights.</li>
        <li>Attempt to gain unauthorized access to the Service, other accounts, or underlying systems.</li>
        <li>Interfere with or disrupt the Service or its infrastructure.</li>
        <li>Use the Service to send spam, unlawful content, or misleading communications.</li>
        <li>Reverse engineer or attempt to extract source code except where permitted by law.</li>
      </Box>

      <Typography component="h2">5. Gmail and Google services (optional)</Typography>
      <Box sx={legalSx.box}>
        <Typography component="p">
          If you connect a Google account to use Gmail features, you also agree to Google’s applicable terms
          and the permissions you grant during OAuth consent. You may revoke access at any time in your Google
          Account settings. Your use of Google user data through the Service is described in our{" "}
          <RouterLink to={PRIVACY_POLICY_PATH}>Privacy Policy</RouterLink>, including compliance with the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          .
        </Typography>
      </Box>

      <Typography component="h2">6. Data and content</Typography>
      <Typography component="p">
        Your organization’s data may be processed as described in the{" "}
        <RouterLink to={PRIVACY_POLICY_PATH}>Privacy Policy</RouterLink>. You are responsible for the accuracy
        of data you enter and for having any required rights to upload or process that data.
      </Typography>

      <Typography component="h2">7. Disclaimers</Typography>
      <Typography component="p">
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
        IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE
        MAXIMUM EXTENT PERMITTED BY LAW.
      </Typography>

      <Typography component="h2">8. Limitation of liability</Typography>
      <Typography component="p">
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS, DATA, OR GOODWILL, ARISING
        FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR CLAIMS ARISING OUT OF OR RELATED TO THE SERVICE
        IS LIMITED TO THE GREATER OF (A) THE AMOUNT YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS
        BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (US $100), IF NO FEES APPLIED.
      </Typography>

      <Typography component="h2">9. Suspension and termination</Typography>
      <Typography component="p">
        We may suspend or terminate access to the Service for violations of these Terms, security risks, or as
        required by law. Provisions that by their nature should survive will survive termination.
      </Typography>

      <Typography component="h2">10. Changes</Typography>
      <Typography component="p">
        We may modify these Terms. We will post the updated Terms on this page and update the effective date.
        Continued use after changes constitutes acceptance where permitted by law.
      </Typography>

      <Typography component="h2">11. Governing law</Typography>
      <Typography component="p">
        These Terms are governed by the laws of <strong>Bhutan</strong>, excluding conflict-of-law rules,
        unless mandatory consumer protections apply.
      </Typography>
    </LegalPageLayout>
  );
}
