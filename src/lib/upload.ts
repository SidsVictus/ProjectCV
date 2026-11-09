/**
 * Sends a file to a presigned storage link and reports how much has gone (0 to 1). Resolves true when storage
 * accepted it. Never throws; the server still checks the stored file afterwards.
 */
export function putFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total); };
    xhr.onloadend = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      // status 0 means the browser refused the request: almost always the bucket's CORS rules not allowing this site
      if (!ok) console.error(`Upload to storage failed (status ${xhr.status}).${xhr.status === 0 ? " The storage bucket's CORS settings must allow this site's address for PUT with the content-type header." : ""}`);
      resolve(ok);
    };
    try { xhr.send(file); } catch { resolve(false); }
  });
}
