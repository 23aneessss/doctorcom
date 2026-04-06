export function openBase64Pdf(params: {
  base64Data: string;
  filename: string;
  mimeType?: string;
}) {
  const mimeType = params.mimeType ?? "application/pdf";
  const binary = atob(params.base64Data);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    const value = binary.charCodeAt(index);
    bytes[index] = value;
  }

  const blob = new Blob([bytes], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (opened) {
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 30_000);
    return;
  }

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = params.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1_000);
}
