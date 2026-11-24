import { ImagePlus } from "lucide-react";
import { validarArquivoDeFoto } from "@hortilink/dominio";

/**
 * Escolher foto (JPG, PNG ou WebP até 1 MB). Entrega a foto em base64 para
 * `onChange` ou a mensagem de erro para `onError`.
 */
export function PhotoPicker({ preview, alt, onChange, onError }) {
  const escolher = (event) => {
    const arquivo = event.target.files[0];
    if (!arquivo) return;
    const problema = validarArquivoDeFoto(arquivo);
    if (problema) {
      onError(problema);
      event.target.value = "";
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => onChange(leitor.result);
    leitor.readAsDataURL(arquivo);
  };

  return (
    <div className="photo-field">
      {preview}
      <label>
        <ImagePlus size={19} aria-hidden="true" />
        <span>
          Escolher foto <small>Opcional · JPG, PNG ou WebP até 1 MB</small>
        </span>
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={alt} onChange={escolher} />
      </label>
    </div>
  );
}
