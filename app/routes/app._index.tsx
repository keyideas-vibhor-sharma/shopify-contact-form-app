import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Button,
  Modal,
  TextField,
  Text,
  Badge,
  Banner,
  BlockStack,
  InlineStack,
  Box,
  EmptyState,
} from "@shopify/polaris";
import { EditIcon, DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export interface SubmissionRecord {
  id: string;
  shop: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  createdAt: string;
  updatedAt: string;
}

// 1. LOADER: Fetch all contact submissions from the database
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const rawSubmissions = await db.contactSubmission.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Convert Date objects to ISO strings for client hydration
  const submissions: SubmissionRecord[] = rawSubmissions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return json({ submissions });
};

// 2. ACTION: Update First and Last Name OR Delete Submission
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = (formData.get("actionType") as string) || "update";
  const id = formData.get("id") as string;

  if (!id) {
    return json({ success: false, error: "Missing submission ID.", message: "" }, { status: 400 });
  }

  // 2A. Handle DELETE action
  if (actionType === "delete") {
    try {
      await db.contactSubmission.delete({
        where: { id },
      });
      return json({ success: true, message: "Contact submission deleted successfully!", error: "" });
    } catch (err: any) {
      return json(
        { success: false, error: "Failed to delete submission: " + (err.message || "Unknown error"), message: "" },
        { status: 500 }
      );
    }
  }

  // 2B. Handle UPDATE action (First and Last Name only)
  const firstName = (formData.get("firstName") as string || "").trim();
  const lastName = (formData.get("lastName") as string || "").trim();

  if (!id) {
    return json({ success: false, error: "Missing submission ID.", message: "" }, { status: 400 });
  }

  if (!firstName || !lastName) {
    return json({ success: false, error: "First Name and Last Name cannot be empty.", message: "" }, { status: 400 });
  }

  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (/\d/.test(firstName) || !nameRegex.test(firstName)) {
    return json({ success: false, error: "Numbers and invalid characters are not allowed in First Name.", message: "" }, { status: 400 });
  }
  if (firstName.length < 2) {
    return json({ success: false, error: "First Name must be at least 2 characters long.", message: "" }, { status: 400 });
  }

  if (/\d/.test(lastName) || !nameRegex.test(lastName)) {
    return json({ success: false, error: "Numbers and invalid characters are not allowed in Last Name.", message: "" }, { status: 400 });
  }
  if (lastName.length < 2) {
    return json({ success: false, error: "Last Name must be at least 2 characters long.", message: "" }, { status: 400 });
  }

  // Update ONLY first and last name.
  // Email and mobile are strictly omitted to guarantee backend data security.
  await db.contactSubmission.update({
    where: { id },
    data: {
      firstName,
      lastName,
    },
  });

  return json({ success: true, message: "Name details updated successfully!", error: "" });
};

// 3. COMPONENT: Polaris Admin View
export default function SubmissionsDashboard() {
  const { submissions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  // Modal State for Editing First and Last Name
  const [modalOpen, setModalOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<SubmissionRecord | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [validationError, setValidationError] = useState("");

  // Modal State for Deleting a Submission
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SubmissionRecord | null>(null);

  const handleOpenEditModal = (record: SubmissionRecord) => {
    setActiveRecord(record);
    setEditFirstName(record.firstName);
    setEditLastName(record.lastName);
    setValidationError("");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setActiveRecord(null);
    setValidationError("");
  };

  const handleOpenDeleteModal = (record: SubmissionRecord) => {
    setRecordToDelete(record);
    setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setRecordToDelete(null);
  };

  const handleConfirmDelete = () => {
    if (!recordToDelete) return;
    submit(
      {
        actionType: "delete",
        id: recordToDelete.id,
      },
      { method: "post" }
    );
    setDeleteModalOpen(false);
    setRecordToDelete(null);
  };

  const handleSaveChanges = () => {
    const trimmedFirst = editFirstName.trim();
    const trimmedLast = editLastName.trim();
    const nameRegex = /^[a-zA-Z\s'-]+$/;

    if (!trimmedFirst || !trimmedLast) {
      setValidationError("Both First Name and Last Name are required.");
      return;
    }

    if (/\d/.test(trimmedFirst) || !nameRegex.test(trimmedFirst)) {
      setValidationError("Numbers and special characters are not allowed in First Name.");
      return;
    }

    if (trimmedFirst.length < 2) {
      setValidationError("First Name must be at least 2 characters long.");
      return;
    }

    if (/\d/.test(trimmedLast) || !nameRegex.test(trimmedLast)) {
      setValidationError("Numbers and special characters are not allowed in Last Name.");
      return;
    }

    if (trimmedLast.length < 2) {
      setValidationError("Last Name must be at least 2 characters long.");
      return;
    }

    if (!activeRecord) return;

    submit(
      {
        actionType: "update",
        id: activeRecord.id,
        firstName: trimmedFirst,
        lastName: trimmedLast,
      },
      { method: "post" }
    );

    setModalOpen(false);
    setActiveRecord(null);
  };

  const resourceName = {
    singular: "contact submission",
    plural: "contact submissions",
  };

  const rowMarkup = submissions.map((record, index) => {
    const { id, firstName, lastName, email, mobile, createdAt } = record;
    const formattedDate = new Date(createdAt).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {firstName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {lastName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200" blockAlign="center">
            <Text variant="bodyMd" as="span">{email}</Text>
            <Badge tone="info">Locked</Badge>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200" blockAlign="center">
            <Text variant="bodyMd" as="span">{mobile}</Text>
            <Badge tone="info">Locked</Badge>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued" as="span">
            {formattedDate}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200" blockAlign="center">
            <Button
              icon={EditIcon}
              onClick={() => handleOpenEditModal(record)}
              accessibilityLabel={`Edit ${firstName} ${lastName}`}
            >
              Edit Name
            </Button>
            <Button
              icon={DeleteIcon}
              tone="critical"
              variant="tertiary"
              onClick={() => handleOpenDeleteModal(record)}
              accessibilityLabel={`Delete ${firstName} ${lastName}`}
            >
              Delete
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Contact Form Submissions"
      subtitle="View customer inquiries and manage contact details."
      compactTitle
    >
      <BlockStack gap="400">
        {actionData?.success && (
          <Banner title="Updated" tone="success" onDismiss={() => {}}>
            <p>{actionData.message}</p>
          </Banner>
        )}

        {actionData?.error && (
          <Banner title="Error" tone="critical" onDismiss={() => {}}>
            <p>{actionData.error}</p>
          </Banner>
        )}

        <Card padding="0">
          {submissions.length === 0 ? (
            <Box padding="600">
              <EmptyState
                heading="No contact submissions yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Submissions received from the storefront contact form will appear here in table format.
                </p>
              </EmptyState>
            </Box>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={submissions.length}
              headings={[
                { title: "First Name" },
                { title: "Last Name" },
                { title: "Email" },
                { title: "Mobile" },
                { title: "Submitted At" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>

      {/* MODAL: Edit First & Last Name Only */}
      {activeRecord && (
        <Modal
          open={modalOpen}
          onClose={handleCloseModal}
          title="Edit Contact Name"
          primaryAction={{
            content: "Save Changes",
            onAction: handleSaveChanges,
            loading: isSaving,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleCloseModal,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Banner tone="info">
                <p>
                  As per data protection rules, <strong>First Name</strong> and <strong>Last Name</strong> can be updated.
                  <strong> Email</strong> and <strong>Mobile</strong> are locked and cannot be edited.
                </p>
              </Banner>

              {validationError && (
                <Banner tone="critical">
                  <p>{validationError}</p>
                </Banner>
              )}

              <TextField
                label="First Name"
                value={editFirstName}
                onChange={(val) => {
                  setEditFirstName(val.replace(/[0-9]/g, ""));
                  if (validationError) setValidationError("");
                }}
                autoComplete="given-name"
                helpText="No numbers allowed (letters only)."
              />

              <TextField
                label="Last Name"
                value={editLastName}
                onChange={(val) => {
                  setEditLastName(val.replace(/[0-9]/g, ""));
                  if (validationError) setValidationError("");
                }}
                autoComplete="family-name"
                helpText="No numbers allowed (letters only)."
              />

              {/* Locked/Read-Only Fields */}
              <TextField
                label="Email Address (Locked)"
                value={activeRecord.email}
                disabled
                autoComplete="email"
                helpText="Email address cannot be changed."
              />

              <TextField
                label="Mobile Number (Locked)"
                value={activeRecord.mobile}
                disabled
                autoComplete="tel"
                helpText="Mobile number cannot be changed."
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

      {/* MODAL: Delete Confirmation */}
      {recordToDelete && (
        <Modal
          open={deleteModalOpen}
          onClose={handleCloseDeleteModal}
          title="Delete Contact Inquiry?"
          primaryAction={{
            content: "Delete Submission",
            destructive: true,
            onAction: handleConfirmDelete,
            loading: isSaving,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleCloseDeleteModal,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                Are you sure you want to delete the submission for{" "}
                <strong>
                  {recordToDelete.firstName} {recordToDelete.lastName}
                </strong>{" "}
                (<code>{recordToDelete.email}</code>)?
              </Text>
              <Banner tone="warning">
                <p>This action is permanent and cannot be undone.</p>
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
