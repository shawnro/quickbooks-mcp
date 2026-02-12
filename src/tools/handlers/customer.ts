// Handlers for customer tools (create, get, edit)

import QuickBooks from "node-quickbooks";
import { promisify } from "../../client/index.js";
import { outputReport } from "../../utils/index.js";

interface AddressInput {
  line1?: string;
  line2?: string;
  line3?: string;
  line4?: string;
  line5?: string;
  city?: string;
  country_sub_division_code?: string;
  postal_code?: string;
  country?: string;
  lat?: string;
  long?: string;
}

interface QBAddress {
  Line1?: string;
  Line2?: string;
  Line3?: string;
  Line4?: string;
  Line5?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
  Country?: string;
  Lat?: string;
  Long?: string;
}

function buildQBAddress(input: AddressInput): QBAddress {
  const addr: QBAddress = {};
  if (input.line1) addr.Line1 = input.line1;
  if (input.line2) addr.Line2 = input.line2;
  if (input.line3) addr.Line3 = input.line3;
  if (input.line4) addr.Line4 = input.line4;
  if (input.line5) addr.Line5 = input.line5;
  if (input.city) addr.City = input.city;
  if (input.country_sub_division_code) addr.CountrySubDivisionCode = input.country_sub_division_code;
  if (input.postal_code) addr.PostalCode = input.postal_code;
  if (input.country) addr.Country = input.country;
  if (input.lat) addr.Lat = input.lat;
  if (input.long) addr.Long = input.long;
  return addr;
}

function formatAddress(addr: QBAddress | undefined, label: string): string[] {
  if (!addr) return [`${label}: (none)`];
  const parts: string[] = [];
  for (const key of ['Line1', 'Line2', 'Line3', 'Line4', 'Line5'] as const) {
    if (addr[key]) parts.push(addr[key]!);
  }
  if (addr.City || addr.CountrySubDivisionCode || addr.PostalCode) {
    const cityState = [addr.City, addr.CountrySubDivisionCode].filter(Boolean).join(', ');
    parts.push([cityState, addr.PostalCode].filter(Boolean).join(' '));
  }
  if (addr.Country) parts.push(addr.Country);
  if (parts.length === 0) return [`${label}: (none)`];
  return [`${label}:`, ...parts.map(p => `  ${p}`)];
}

// QB Customer object shape (relevant fields)
interface QBCustomer {
  Id: string;
  SyncToken: string;
  DisplayName: string;
  GivenName?: string;
  MiddleName?: string;
  FamilyName?: string;
  Suffix?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  Mobile?: { FreeFormNumber?: string };
  BillAddr?: QBAddress;
  ShipAddr?: QBAddress;
  Notes?: string;
  Taxable?: boolean;
  Active?: boolean;
  Balance?: number;
  MetaData?: { CreateTime?: string; LastUpdatedTime?: string };
}

export async function handleCreateCustomer(
  client: QuickBooks,
  args: {
    display_name: string;
    given_name?: string;
    middle_name?: string;
    family_name?: string;
    suffix?: string;
    company_name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    bill_address?: AddressInput;
    ship_address?: AddressInput;
    notes?: string;
    taxable?: boolean;
    draft?: boolean;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    display_name, given_name, middle_name, family_name, suffix,
    company_name, email, phone, mobile,
    bill_address, ship_address, notes, taxable, draft = true,
  } = args;

  // Build QB Customer object
  const customerObj: Record<string, unknown> = {
    DisplayName: display_name,
  };
  if (given_name) customerObj.GivenName = given_name;
  if (middle_name) customerObj.MiddleName = middle_name;
  if (family_name) customerObj.FamilyName = family_name;
  if (suffix) customerObj.Suffix = suffix;
  if (company_name) customerObj.CompanyName = company_name;
  if (email) customerObj.PrimaryEmailAddr = { Address: email };
  if (phone) customerObj.PrimaryPhone = { FreeFormNumber: phone };
  if (mobile) customerObj.Mobile = { FreeFormNumber: mobile };
  if (bill_address) customerObj.BillAddr = buildQBAddress(bill_address);
  if (ship_address) customerObj.ShipAddr = buildQBAddress(ship_address);
  if (notes) customerObj.Notes = notes;
  if (taxable !== undefined) customerObj.Taxable = taxable;

  if (draft) {
    const preview = [
      "DRAFT - Customer Preview",
      "",
      `Display Name: ${display_name}`,
      ...(given_name || middle_name || family_name || suffix
        ? [`Name Parts: ${[given_name, middle_name, family_name, suffix].filter(Boolean).join(' ')}`]
        : []),
      `Company: ${company_name || "(none)"}`,
      `Email: ${email || "(none)"}`,
      `Phone: ${phone || "(none)"}`,
      `Mobile: ${mobile || "(none)"}`,
      ...formatAddress(bill_address ? buildQBAddress(bill_address) : undefined, "Billing Address"),
      ...formatAddress(ship_address ? buildQBAddress(ship_address) : undefined, "Shipping Address"),
      `Notes: ${notes || "(none)"}`,
      `Taxable: ${taxable !== undefined ? taxable : "(default)"}`,
      "",
      "Set draft=false to create this customer.",
    ].join("\n");

    return { content: [{ type: "text", text: preview }] };
  }

  const result = await promisify<unknown>((cb) =>
    client.createCustomer(customerObj, cb)
  ) as QBCustomer;

  const qboUrl = `https://app.qbo.intuit.com/app/customerdetail?nameId=${result.Id}`;

  const response = [
    "Customer Created!",
    "",
    `ID: ${result.Id}`,
    `Display Name: ${result.DisplayName}`,
    "",
    `View in QuickBooks: ${qboUrl}`,
  ].join("\n");

  return { content: [{ type: "text", text: response }] };
}

export async function handleGetCustomer(
  client: QuickBooks,
  args: { id: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { id } = args;

  const customer = await promisify<unknown>((cb) =>
    client.getCustomer(id, cb)
  ) as QBCustomer;

  const qboUrl = `https://app.qbo.intuit.com/app/customerdetail?nameId=${customer.Id}`;

  const lines: string[] = [
    "Customer",
    "========",
    `ID: ${customer.Id}`,
    `SyncToken: ${customer.SyncToken}`,
    `Display Name: ${customer.DisplayName}`,
    `Active: ${customer.Active !== false}`,
  ];

  if (customer.GivenName || customer.MiddleName || customer.FamilyName || customer.Suffix) {
    lines.push(`Name: ${[customer.GivenName, customer.MiddleName, customer.FamilyName, customer.Suffix].filter(Boolean).join(' ')}`);
  }
  if (customer.CompanyName) lines.push(`Company: ${customer.CompanyName}`);
  lines.push(`Email: ${customer.PrimaryEmailAddr?.Address || "(none)"}`);
  lines.push(`Phone: ${customer.PrimaryPhone?.FreeFormNumber || "(none)"}`);
  lines.push(`Mobile: ${customer.Mobile?.FreeFormNumber || "(none)"}`);
  lines.push(...formatAddress(customer.BillAddr, "Billing Address"));
  lines.push(...formatAddress(customer.ShipAddr, "Shipping Address"));
  if (customer.Notes) lines.push(`Notes: ${customer.Notes}`);
  lines.push(`Taxable: ${customer.Taxable ?? "(default)"}`);
  lines.push(`Balance: $${(customer.Balance || 0).toFixed(2)}`);
  lines.push("");
  lines.push(`View in QuickBooks: ${qboUrl}`);

  return outputReport(`customer-${customer.Id}`, customer, lines.join("\n"));
}

export async function handleEditCustomer(
  client: QuickBooks,
  args: {
    id: string;
    display_name?: string;
    given_name?: string;
    middle_name?: string;
    family_name?: string;
    suffix?: string;
    company_name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    bill_address?: AddressInput;
    ship_address?: AddressInput;
    notes?: string;
    taxable?: boolean;
    active?: boolean;
    draft?: boolean;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    id, display_name, given_name, middle_name, family_name, suffix,
    company_name, email, phone, mobile,
    bill_address, ship_address, notes, taxable, active, draft = true,
  } = args;

  // Fetch current customer
  const current = await promisify<unknown>((cb) =>
    client.getCustomer(id, cb)
  ) as QBCustomer;

  // Build sparse update
  const updated: Record<string, unknown> = {
    Id: current.Id,
    SyncToken: current.SyncToken,
    sparse: true,
  };

  if (display_name !== undefined) updated.DisplayName = display_name;
  if (given_name !== undefined) updated.GivenName = given_name;
  if (middle_name !== undefined) updated.MiddleName = middle_name;
  if (family_name !== undefined) updated.FamilyName = family_name;
  if (suffix !== undefined) updated.Suffix = suffix;
  if (company_name !== undefined) updated.CompanyName = company_name;
  if (email !== undefined) updated.PrimaryEmailAddr = { Address: email };
  if (phone !== undefined) updated.PrimaryPhone = { FreeFormNumber: phone };
  if (mobile !== undefined) updated.Mobile = { FreeFormNumber: mobile };
  if (bill_address !== undefined) updated.BillAddr = buildQBAddress(bill_address);
  if (ship_address !== undefined) updated.ShipAddr = buildQBAddress(ship_address);
  if (notes !== undefined) updated.Notes = notes;
  if (taxable !== undefined) updated.Taxable = taxable;
  if (active !== undefined) updated.Active = active;

  const qboUrl = `https://app.qbo.intuit.com/app/customerdetail?nameId=${id}`;

  if (draft) {
    const previewLines: string[] = [
      "DRAFT - Customer Edit Preview",
      "",
      `ID: ${id}`,
      `SyncToken: ${current.SyncToken}`,
      "",
      "Changes:",
    ];

    if (display_name !== undefined) previewLines.push(`  Display Name: ${current.DisplayName} → ${display_name}`);
    if (given_name !== undefined) previewLines.push(`  Given Name: ${current.GivenName || "(none)"} → ${given_name}`);
    if (middle_name !== undefined) previewLines.push(`  Middle Name: ${current.MiddleName || "(none)"} → ${middle_name}`);
    if (family_name !== undefined) previewLines.push(`  Family Name: ${current.FamilyName || "(none)"} → ${family_name}`);
    if (suffix !== undefined) previewLines.push(`  Suffix: ${current.Suffix || "(none)"} → ${suffix}`);
    if (company_name !== undefined) previewLines.push(`  Company: ${current.CompanyName || "(none)"} → ${company_name}`);
    if (email !== undefined) previewLines.push(`  Email: ${current.PrimaryEmailAddr?.Address || "(none)"} → ${email}`);
    if (phone !== undefined) previewLines.push(`  Phone: ${current.PrimaryPhone?.FreeFormNumber || "(none)"} → ${phone}`);
    if (mobile !== undefined) previewLines.push(`  Mobile: ${current.Mobile?.FreeFormNumber || "(none)"} → ${mobile}`);
    if (bill_address !== undefined) previewLines.push("  Billing Address: (updating)");
    if (ship_address !== undefined) previewLines.push("  Shipping Address: (updating)");
    if (notes !== undefined) previewLines.push(`  Notes: ${current.Notes || "(none)"} → ${notes}`);
    if (taxable !== undefined) previewLines.push(`  Taxable: ${current.Taxable ?? "(default)"} → ${taxable}`);
    if (active !== undefined) previewLines.push(`  Active: ${current.Active !== false} → ${active}`);

    previewLines.push("");
    previewLines.push("Set draft=false to apply these changes.");

    return { content: [{ type: "text", text: previewLines.join("\n") }] };
  }

  const result = await promisify<unknown>((cb) =>
    client.updateCustomer(updated, cb)
  ) as QBCustomer;

  return {
    content: [{
      type: "text",
      text: `Customer ${id} updated successfully.\nNew SyncToken: ${result.SyncToken}\nView in QuickBooks: ${qboUrl}`,
    }],
  };
}
