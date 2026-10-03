export function whatsappLink(message: string, phone?: string | null) {
  const text = encodeURIComponent(message);
  const digits = phone?.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function smsLink(message: string, phone?: string | null) {
  const body = encodeURIComponent(message);
  const number = phone?.replace(/[^\d+]/g, "") ?? "";
  return `sms:${number}?&body=${body}`;
}
