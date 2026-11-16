import { useState, type FormEvent } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/client';
import { ImageField } from '../../components/backoffice/ImageField';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../context/toast';
import { useCategories } from '../../hooks/useCategories';
import { useCreateBook } from '../../hooks/useCreateBook';
import { useLevels } from '../../hooks/useLevels';
import { useSchoolClasses } from '../../hooks/useSchoolClasses';
import './BackofficeAddBookPage.css';

interface SelectedGrade {
  id: string;
  name: string;
  educationLevel: string;
}

interface BookFormState {
  title: string;
  categoryId: string;
  price: string;
  author: string;
  isbn: string;
  available: boolean;
  image: File | null;
}

const initialForm: BookFormState = {
  title: '',
  categoryId: '',
  price: '',
  author: '',
  isbn: '',
  available: true,
  image: null,
};

export function BackofficeAddBookPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { mutate: createBook, isPending } = useCreateBook();
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories();
  const { data: levels = [], isLoading: isLevelsLoading } = useLevels();
  const [form, setForm] = useState<BookFormState>(initialForm);
  const [selectedGrades, setSelectedGrades] = useState<SelectedGrade[]>([]);
  const [educationLevelId, setEducationLevelId] = useState('');
  const [pendingGradeId, setPendingGradeId] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof BookFormState, string>>>({});
  const [gradesError, setGradesError] = useState<string | undefined>();
  const { data: schoolClasses = [], isLoading: isSchoolClassesLoading } = useSchoolClasses(educationLevelId);

  const selectedLevelName = levels.find((level) => level.id === educationLevelId)?.name ?? '';

  const updateField = <K extends keyof BookFormState>(key: K, value: BookFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleEducationLevelChange = (value: string) => {
    setEducationLevelId(value);
    setPendingGradeId('');
  };

  const handleAddGrade = () => {
    if (!educationLevelId) {
      setGradesError('Seleccione o nível de ensino');
      return;
    }
    if (!pendingGradeId) {
      setGradesError('Seleccione uma classe para adicionar');
      return;
    }

    const schoolClass = schoolClasses.find((item) => item.id === pendingGradeId);
    if (!schoolClass) return;

    if (selectedGrades.some((grade) => grade.id === pendingGradeId)) {
      setGradesError('Esta classe já foi adicionada');
      return;
    }

    setSelectedGrades((prev) => [...prev, { id: schoolClass.id, name: schoolClass.name, educationLevel: selectedLevelName }]);
    setPendingGradeId('');
    setGradesError(undefined);
  };

  const handleRemoveGrade = (gradeId: string) => {
    setSelectedGrades((prev) => prev.filter((grade) => grade.id !== gradeId));
    if (gradesError) setGradesError(undefined);
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof BookFormState, string>> = {};

    if (!form.title.trim()) newErrors.title = 'Obrigatório';
    if (!form.categoryId) newErrors.categoryId = 'Seleccione uma categoria';
    if (!form.price.trim()) newErrors.price = 'Obrigatório';
    else if (Number.isNaN(Number(form.price)) || Number(form.price) <= 0) newErrors.price = 'Preço inválido';
    if (!form.author.trim()) newErrors.author = 'Obrigatório';
    if (!form.isbn.trim()) newErrors.isbn = 'Obrigatório';
    if (!form.image) newErrors.image = 'Seleccione uma imagem';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate() || !form.image) return;

    createBook(
      {
        dto: {
          title: form.title.trim(),
          categoryId: form.categoryId,
          grades: selectedGrades.map((grade) => grade.id),
          price: Number(form.price),
          author: form.author.trim(),
          isbn: form.isbn.trim(),
          available: form.available,
        },
        imagem: form.image,
      },
      {
        onSuccess: () => {
          showToast('Livro criado.');
          navigate('/backoffice/livros');
        },
        onError: (error) => {
          showToast(getApiErrorMessage(error, 'Não foi possível criar o livro. Tente novamente.'), 'error');
        },
      },
    );
  };

  return (
    <div className="backoffice-page backoffice-add-book-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Adicionar livro</h1>
              <p className="section-subtitle">Preencha os dados do livro e, se for um manual escolar, associe as classes.</p>
            </div>
            <Link to="/backoffice/livros" className="btn btn-outline backoffice-add-book-back">
              <ArrowLeft size={16} />
              Voltar aos livros
            </Link>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        <div className="backoffice-add-book-card">
          <form className="add-book-form" onSubmit={handleSubmit} noValidate>
            <section className="add-book-grades-section">
              <div className="add-book-section-header">
                <h2 className="add-book-section-title">Classes (opcional)</h2>
                <p className="add-book-section-subtitle">
                  Para manuais escolares: seleccione o nível e a classe, e adicione quantas forem precisas.
                </p>
              </div>

              <div className="add-book-grades-picker">
                <div className="form-group">
                  <label className="form-label" htmlFor="book-level">Nível de ensino</label>
                  <Select
                    id="book-level"
                    value={educationLevelId}
                    onChange={handleEducationLevelChange}
                    disabled={isLevelsLoading}
                    placeholder={isLevelsLoading ? 'A carregar…' : 'Seleccione o nível'}
                    options={levels.map((level) => ({ value: level.id, label: level.name }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="book-grade">Classe</label>
                  <Select
                    id="book-grade"
                    value={pendingGradeId}
                    onChange={setPendingGradeId}
                    disabled={!educationLevelId || isSchoolClassesLoading}
                    placeholder={
                      !educationLevelId
                        ? 'Seleccione o nível primeiro'
                        : isSchoolClassesLoading
                          ? 'A carregar…'
                          : 'Seleccione a classe'
                    }
                    options={schoolClasses.map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name }))}
                    clearable={false}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary add-book-grades-add"
                  onClick={handleAddGrade}
                  disabled={!educationLevelId || !pendingGradeId}
                  aria-label="Adicionar classe"
                >
                  <Plus size={16} />
                </button>
              </div>

              {gradesError && <span className="form-error add-book-grades-error">{gradesError}</span>}

              {selectedGrades.length > 0 ? (
                <div className="add-book-grades-table-wrap">
                  <table className="add-book-grades-table">
                    <thead>
                      <tr>
                        <th>Nível</th>
                        <th>Classe</th>
                        <th>Acções</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGrades.map((grade) => (
                        <tr key={grade.id}>
                          <td>{grade.educationLevel}</td>
                          <td>{grade.name}</td>
                          <td>
                            <button
                              type="button"
                              className="add-book-grade-remove"
                              onClick={() => handleRemoveGrade(grade.id)}
                              aria-label={`Remover ${grade.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="add-book-grades-empty">Nenhuma classe adicionada.</div>
              )}
            </section>

            <div className="add-book-form-divider" />

            <div className="add-book-form-grid">
              <div className="form-group form-group-full">
                <label className="form-label" htmlFor="book-title">Título</label>
                <input
                  id="book-title"
                  className={`form-input ${errors.title ? 'error' : ''}`}
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Ex.: Gramática de Português"
                />
                {errors.title && <span className="form-error">{errors.title}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="book-category">Categoria</label>
                <Select
                  id="book-category"
                  error={Boolean(errors.categoryId)}
                  value={form.categoryId}
                  onChange={(value) => updateField('categoryId', value)}
                  disabled={isCategoriesLoading}
                  placeholder={isCategoriesLoading ? 'A carregar…' : 'Seleccione a categoria'}
                  options={categories.map((category) => ({ value: category.id, label: category.name }))}
                  clearable={false}
                />
                {errors.categoryId && <span className="form-error">{errors.categoryId}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="book-price">Preço (Kz)</label>
                <input
                  id="book-price"
                  type="number"
                  min="1"
                  step="1"
                  className={`form-input ${errors.price ? 'error' : ''}`}
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  placeholder="Ex.: 5000"
                />
                {errors.price && <span className="form-error">{errors.price}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="book-author">Autor</label>
                <input
                  id="book-author"
                  className={`form-input ${errors.author ? 'error' : ''}`}
                  value={form.author}
                  onChange={(e) => updateField('author', e.target.value)}
                  placeholder="Ex.: Pepetela"
                />
                {errors.author && <span className="form-error">{errors.author}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="book-isbn">ISBN</label>
                <input
                  id="book-isbn"
                  className={`form-input ${errors.isbn ? 'error' : ''}`}
                  value={form.isbn}
                  onChange={(e) => updateField('isbn', e.target.value)}
                  placeholder="Ex.: 978-989-1234-01-1"
                />
                {errors.isbn && <span className="form-error">{errors.isbn}</span>}
              </div>

              <ImageField
                id="book-image"
                label="Capa do livro"
                file={form.image}
                error={errors.image}
                onChange={(file) => updateField('image', file)}
                onInvalidFile={() => showToast('Seleccione um ficheiro de imagem.', 'error')}
              />

              <div className="form-group form-group-full">
                <label className="add-book-checkbox">
                  <input
                    type="checkbox"
                    checked={form.available}
                    onChange={(e) => updateField('available', e.target.checked)}
                  />
                  Livro disponível para encomenda
                </label>
              </div>
            </div>

            <div className="add-book-form-actions">
              <Link to="/backoffice/livros" className="btn btn-outline">
                Cancelar
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? 'A guardar…' : 'Criar livro'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
