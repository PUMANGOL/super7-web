import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { sizedImageUrl } from '../../api/images';
import '../../pages/backoffice/BackofficeAddBookPage.css';

interface ImageFieldProps {
  id: string;
  label: string;
  file: File | null;
  /** Imagem actual (na edição), mostrada enquanto não se escolhe outra. */
  currentUrl?: string | null;
  error?: string;
  onChange: (file: File | null) => void;
  onInvalidFile: () => void;
}

export function ImageField({ id, label, file, currentUrl, error, onChange, onInvalidFile }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const select = (selected: File | null | undefined) => {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      onInvalidFile();
      return;
    }
    onChange(selected);
  };

  const clear = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    select(event.dataTransfer.files?.[0]);
  };

  const shownUrl = previewUrl ?? sizedImageUrl(currentUrl, 320) ?? null;

  return (
    <div className="form-group form-group-full">
      <span className="form-label">{label}</span>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        className="add-book-file-input"
        onChange={(event) => select(event.target.files?.[0])}
      />

      {shownUrl ? (
        <div className={`add-book-upload add-book-upload--filled ${error ? 'add-book-upload--error' : ''}`}>
          <div className="add-book-upload-preview">
            <img src={shownUrl} alt="Pré-visualização da imagem" />
          </div>
          <div className="add-book-upload-details">
            <span className="add-book-upload-filename">{file ? file.name : 'Imagem actual'}</span>
            {file && <span className="add-book-upload-size">{(file.size / 1024).toFixed(0)} KB</span>}
            <div className="add-book-upload-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}>
                {file ? 'Substituir' : 'Escolher outra'}
              </button>
              {file && (
                <button type="button" className="btn btn-ghost btn-sm add-book-upload-remove" onClick={clear}>
                  <X size={16} />
                  {currentUrl ? 'Manter a actual' : 'Remover'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={['add-book-upload', dragging && 'add-book-upload--dragging', error && 'add-book-upload--error']
            .filter(Boolean)
            .join(' ')}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={onDrop}
        >
          <span className="add-book-upload-icon" aria-hidden="true">
            {dragging ? <Upload size={28} /> : <ImagePlus size={28} />}
          </span>
          <span className="add-book-upload-title">{dragging ? 'Largue a imagem aqui' : 'Clique para escolher a imagem'}</span>
          <span className="add-book-upload-hint">ou arraste e largue · PNG, JPG ou WEBP, de preferência com fundo transparente</span>
        </button>
      )}

      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
