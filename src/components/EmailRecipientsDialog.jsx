import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  Collapse,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import GroupIcon from "@mui/icons-material/Group";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import {
  getRecipientGroups,
  saveRecipientGroups,
  getSenderEmail,
  parseEmailListInput,
  createRecipientGroupId,
} from "../services/emailService";

import { BRAND_PRIMARY } from "../constants/brand";

const BRAND = BRAND_PRIMARY;

function EmailRecipientsDialog({ open, onClose }) {
  const [groups, setGroups] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupEmailsText, setNewGroupEmailsText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (open) {
      setGroups(getRecipientGroups());
      setExpandedId(null);
      setNewGroupName("");
      setNewGroupEmailsText("");
      setShowAddForm(false);
      setError("");
      getSenderEmail()
        .then((email) => setSenderEmail(email || "Not logged in"))
        .catch(() => setSenderEmail(localStorage.getItem("admin_email") || "Not logged in"));
    }
  }, [open]);

  const totalEmails = groups.reduce((n, g) => n + g.emails.length, 0);

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    const emails = parseEmailListInput(newGroupEmailsText);
    if (!name) {
      setError("Group name is required");
      return;
    }
    if (emails.length === 0) {
      setError("Add at least one valid email (comma or new line separated)");
      return;
    }
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      setError("A group with this name already exists");
      return;
    }
    setGroups([...groups, { id: createRecipientGroupId(), name, emails }]);
    setNewGroupName("");
    setNewGroupEmailsText("");
    setShowAddForm(false);
    setError("");
  };

  const handleDeleteGroup = (id) => {
    setGroups(groups.filter((g) => g.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdateGroupEmails = (id, text) => {
    const emails = parseEmailListInput(text);
    setGroups(
      groups.map((g) => (g.id === id ? { ...g, emails: emails.length ? emails : g.emails } : g))
    );
  };

  const handleRenameGroup = (id, name) => {
    setGroups(groups.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)));
  };

  const handleSave = () => {
    saveRecipientGroups(groups);
    onClose();
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      scroll="paper"
      PaperProps={{ sx: { display: "flex", flexDirection: "column" } }}
    >
      <DialogTitle
        sx={{
          bgcolor: BRAND,
          color: "white",
          py: 2,
          px: 2.5,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <GroupIcon sx={{ fontSize: 32, opacity: 0.95 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Approval recipient groups
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Add a whole team at once — first email is the approver (To), rest are CC
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "white", mt: -0.5 }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          flex: 1,
          overflow: "auto",
          px: { xs: 2, sm: 3 },
          py: 2,
          bgcolor: "#fafafa",
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: "#e8f5e9", borderColor: "#c8e6c9" }}>
          <Typography variant="caption" color="text.secondary">
            Sender (when you send orders)
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "#2e7d32" }}>
            {senderEmail}
          </Typography>
        </Paper>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`${groups.length} group${groups.length !== 1 ? "s" : ""}`} />
          <Chip size="small" variant="outlined" label={`${totalEmails} email${totalEmails !== 1 ? "s" : ""}`} />
        </Stack>

        {!showAddForm ? (
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setShowAddForm(true)}
            sx={{
              mb: 2,
              py: 1.25,
              borderStyle: "dashed",
              borderColor: BRAND,
              color: BRAND,
              "&:hover": { borderColor: BRAND, bgcolor: "rgba(214,25,22,0.04)" },
            }}
          >
            Add recipient group
          </Button>
        ) : (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: BRAND, borderWidth: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: BRAND }}>
              New group
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Group name"
              placeholder="e.g. GM & Regional Managers"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              sx={{ mb: 1.5 }}
            />
            <TextField
              fullWidth
              multiline
              minRows={4}
              label="Emails in this group"
              placeholder={
                "mqc@bhutancoke.com\nmanager1@bhutancoke.com, manager2@bhutancoke.com"
              }
              value={newGroupEmailsText}
              onChange={(e) => setNewGroupEmailsText(e.target.value)}
              helperText="Paste multiple emails separated by commas, spaces, or new lines. First email = primary approver (To)."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                    <ContentPasteIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            {newGroupEmailsText.trim() && (
              <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {parseEmailListInput(newGroupEmailsText).map((email, i) => (
                  <Chip
                    key={email}
                    size="small"
                    label={email}
                    color={i === 0 ? "primary" : "default"}
                    variant={i === 0 ? "filled" : "outlined"}
                    icon={i === 0 ? <EmailIcon /> : undefined}
                  />
                ))}
              </Box>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
              <Button size="small" onClick={() => { setShowAddForm(false); setError(""); }}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleAddGroup}
                sx={{ bgcolor: BRAND, "&:hover": { bgcolor: "#b01512" } }}
              >
                Add group
              </Button>
            </Stack>
          </Paper>
        )}

        {groups.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              py: 4,
              textAlign: "center",
              bgcolor: "white",
              borderStyle: "dashed",
            }}
          >
            <GroupIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary" variant="body2">
              No groups yet. Add one to speed up sending orders for approval.
            </Typography>
          </Paper>
        ) : (
          <List disablePadding sx={{ bgcolor: "white", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
            {groups.map((group, idx) => {
              const expanded = expandedId === group.id;
              const preview = group.emails.slice(0, 2).join(", ");
              const more = group.emails.length - 2;
              return (
                <Box key={group.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    sx={{ py: 1.25, alignItems: "flex-start" }}
                    secondaryAction={
                      <Stack direction="row" spacing={0.25}>
                        <Tooltip title={expanded ? "Collapse" : "Edit emails"}>
                          <IconButton
                            size="small"
                            onClick={() => setExpandedId(expanded ? null : group.id)}
                          >
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, pr: 6 }}>
                          {group.name}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            To: <strong>{group.emails[0]}</strong>
                            {group.emails.length > 1 &&
                              ` · CC: ${group.emails.length - 1} more`}
                          </Typography>
                          {!expanded && (
                            <Typography variant="caption" color="text.disabled" noWrap display="block" sx={{ maxWidth: 280 }}>
                              {preview}
                              {more > 0 ? ` +${more} more` : ""}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  <Collapse in={expanded}>
                    <Box sx={{ px: 2, pb: 2, pt: 0 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Group name"
                        value={group.name}
                        onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Emails"
                        defaultValue={group.emails.join("\n")}
                        key={`${group.id}-${group.emails.join(",")}`}
                        onBlur={(e) => handleUpdateGroupEmails(group.id, e.target.value)}
                        helperText="First line/email = approver (To). Save dialog to persist."
                      />
                      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                        {group.emails.map((email, i) => (
                          <Chip
                            key={email}
                            size="small"
                            label={i === 0 ? `To: ${email}` : email}
                            color={i === 0 ? "primary" : "default"}
                            variant={i === 0 ? "filled" : "outlined"}
                          />
                        ))}
                      </Stack>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: "divider" }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={groups.length === 0}
          sx={{ bgcolor: BRAND, "&:hover": { bgcolor: "#b01512" } }}
        >
          Save groups
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default EmailRecipientsDialog;
