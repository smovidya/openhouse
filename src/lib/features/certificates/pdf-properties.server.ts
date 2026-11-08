import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
} from "pdf-lib";
import type { CERTIFICATE_EVENT } from "./shared";

export type CertificatePdfMetadata = {
  issuanceId: string;
  issuedAt: number;
  event: typeof CERTIFICATE_EVENT;
};

export async function finalizeCertificatePdf(
  bytes: Uint8Array,
  properties: CertificatePdfMetadata & {
    name: string;
    school: string;
    verificationUrl: string;
    templateVersion: string;
  },
) {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (pdf.getPageCount() !== 1)
    throw new Error("Certificate must have one page");
  const { event } = properties;
  const issuedAt = new Date(properties.issuedAt * 1000);
  pdf.setTitle(
    `${event.title} - Participation Certificate - ${properties.name}`,
  );
  pdf.setAuthor("Faculty of Science, Chulalongkorn University");
  pdf.setSubject(
    `Certificate of participation in ${event.title}; award date ${event.awardDate}`,
  );
  pdf.setKeywords([
    "certificate",
    "participation",
    event.title,
    "Chulalongkorn University",
  ]);
  pdf.setCreator("Science Chula Open House Certificate Service");
  pdf.setProducer("Science Chula Open House Certificate Service");
  pdf.setCreationDate(issuedAt);
  pdf.setModificationDate(new Date());
  pdf.catalog.set(PDFName.of("Lang"), PDFString.of("th-TH"));
  pdf.catalog.getOrCreateViewerPreferences().setDisplayDocTitle(true);
  const info = pdf.context.lookup(pdf.context.trailerInfo.Info!, PDFDict);
  const details = {
    CertificateID: properties.issuanceId,
    CertificateType: event.type,
    RecipientName: properties.name,
    School: properties.school,
    EventID: event.id,
    EventTitle: event.title,
    EventStartsAt: String(event.startsAt),
    EventEndsAt: String(event.endsAt),
    AwardDate: event.awardDate,
    IssuedAt: issuedAt.toISOString(),
    TemplateVersion: properties.templateVersion,
    VerificationURL: properties.verificationUrl,
  };
  for (const [key, value] of Object.entries(details)) {
    info.set(PDFName.of(key), PDFHexString.fromText(value));
  }
  return pdf.save();
}
