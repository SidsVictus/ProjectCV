/**
 * Sends a file to a presigned storage link and reports how much has gone (0 to 1). Never throws:
 * like before, a failed upload is found by the server's own check of the stored file afterwards.
 */
export function putFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total); };
    xhr.onloadend = () => resolve();
    try { xhr.send(file); } catch { resolve(); }
  });
}
