import React from "react";
import { Box, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import LegalPageLayout, { legalSx } from "../components/legal/LegalPageLayout";
import { TERMS_OF_SERVICE_PATH } from "../constants/brand";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      footerLinks={
        <Typography variant="body2" component="p">
          <RouterLink to={TERMS_OF_SERVICE_PATH}>Terms of Service</RouterLink>
          {" · "}
          <RouterLink to="/">Home</RouterLink>
          {" · "}
          <RouterLink to="/login">Sign in</RouterLink>
        </Typography>
      }
    >
      <Typography component="h1" variant="h4">
        Privacy Policy
      </Typography>
      <Typography sx={legalSx.meta}>
        <strong>Distribution Prime</strong>
        <br />
        Effective date: March 24, 2025
      </Typography>

      <Typography component="p">
        This Privacy Policy describes how the Distribution Prime web application (“<strong>App</strong>,”
        “<strong>we</strong>,” “<strong>us</strong>”) collects, uses, stores, and shares information when you
        use the App. By using the App, you agree to this policy.
      </Typography>

      <Typography component="h2">1. Who we are</Typography>
      <Typography component="p">
        The App is operated by <strong>Distribution Prime</strong>. For privacy questions, contact:{" "}
        <strong>codewynbuild@gmail.com</strong>.
      </Typography>

      <Typography component="h2">2. Information we collect</Typography>
      <Box component="ul">
        <li>
          <strong>Account and authentication data:</strong> Identifiers you use to sign in (for example,
          distributor codes or email addresses for administrators), session data, and authentication
          information processed through our backend (such as Supabase Auth) where configured.
        </li>
        <li>
          <strong>Business and operational data:</strong> Distributor profiles, sales targets, achievements,
          orders, stock or physical stock data, schemes, activity logs, and related information entered or
          uploaded by authorized users.
        </li>
        <li>
          <strong>Technical data:</strong> Browser type, general device information, and timestamps when you use
          the App.
        </li>
        <li>
          <strong>Locally stored data:</strong> The App may store certain preferences or tokens in your browser
          (for example, <code>localStorage</code> or <code>sessionStorage</code>) to keep you signed in or to
          remember settings.
        </li>
        <li>
          <strong>Google user data (optional — Gmail integration):</strong> If an authorized administrator
          connects Google Gmail through the App, we request access only as described in the consent screen. We
          use Gmail APIs to send order-related emails and, where enabled, to read replies in the connected
          mailbox to detect approval or rejection of orders. We do not use Gmail data for advertising.
        </li>
      </Box>

      <Typography component="h2">3. How we use information</Typography>
      <Box component="ul">
        <li>To provide, operate, and secure the App.</li>
        <li>To authenticate users and enforce access controls.</li>
        <li>To process distributor performance, targets, orders, and reporting features you use.</li>
        <li>To send transactional or operational emails when you use email features (including via Gmail API when connected).</li>
        <li>To comply with law or protect rights and safety where required.</li>
      </Box>

      <Typography component="h2">4. Google API Services — Gmail (Limited Use)</Typography>
      <Box sx={legalSx.box}>
        <Typography component="p">
          The App’s use of information received from <strong>Google APIs</strong> adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the <strong>Limited Use</strong> requirements.
        </Typography>
        <Typography component="p">
          Specifically, we only use Gmail data to provide or improve user-facing features of the App that are
          prominent in the App’s interface (for example, sending order emails and processing reply content to
          update order status). We do not sell Gmail data. We do not use Gmail data for serving advertisements.
          We do not allow humans to read Gmail content except (a) with your consent, (b) for security or
          compliance, (c) when required by law, or (d) when aggregated and anonymized for internal operations.
        </Typography>
      </Box>

      <Typography component="h2">5. Service providers</Typography>
      <Typography component="p">
        We use third-party services to run the App, which may process data on our behalf, including:
      </Typography>
      <Box component="ul">
        <li>
          <strong>Supabase</strong> (or your configured backend) for authentication, database, and related
          infrastructure.
        </li>
        <li>
          <strong>Google</strong> (Gmail API and related Google services) when Gmail is connected.
        </li>
        <li>
          <strong>Hosting provider</strong> (for example, the platform that serves this website).
        </li>
      </Box>
      <Typography component="p">Their use of data is governed by their respective terms and privacy policies.</Typography>

      <Typography component="h2">6. Retention</Typography>
      <Typography component="p">
        We retain information for as long as needed to provide the App and for legitimate business purposes
        (including legal, tax, or audit requirements), unless a shorter period is required by law. Administrators
        may be able to delete or export certain data depending on App configuration.
      </Typography>

      <Typography component="h2">7. Security</Typography>
      <Typography component="p">
        We implement reasonable technical and organizational measures to protect information. No method of
        transmission or storage is completely secure.
      </Typography>

      <Typography component="h2">8. Your rights</Typography>
      <Typography component="p">
        Depending on <strong>Bhutan</strong>, you may have rights to access, correct, delete, or restrict
        processing of your personal data, or to object to certain processing. Contact{" "}
        <strong>codewynbuild@gmail.com</strong> to make a request. You may also revoke the App’s access to your
        Google account at any time in your{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          Google Account permissions
        </a>
        .
      </Typography>

      <Typography component="h2">9. Children</Typography>
      <Typography component="p">
        The App is not intended for children under 16, and we do not knowingly collect their personal
        information.
      </Typography>

      <Typography component="h2">10. Changes</Typography>
      <Typography component="p">
        We may update this Privacy Policy. We will post the updated version on this page and update the
        effective date.
      </Typography>
    </LegalPageLayout>
  );
}
