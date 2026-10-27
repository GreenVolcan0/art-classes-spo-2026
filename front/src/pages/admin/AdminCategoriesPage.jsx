import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Modal, Table } from 'react-bootstrap';
import { categoriesApi } from '../../api/api';
import { getApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Loading from '../../components/ui/Loading';

export default function AdminCategoriesPage() {
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editTarget, setEditTarget] = useState(null); // { id, name, description }
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await categoriesApi.list();
      setItems(data);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setCreateError('Введите название категории');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await categoriesApi.create({
        name: name.trim(),
        description: description.trim() || null,
      });
      toast('Категория создана', 'success');
      setName('');
      setDescription('');
      load();
    } catch (err) {
      setCreateError(getApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editTarget.name.trim()) {
      toast('Название не может быть пустым', 'warning');
      return;
    }
    setEditSaving(true);
    try {
      await categoriesApi.update(editTarget.id, {
        name: editTarget.name.trim(),
        description: editTarget.description?.trim() || null,
      });
      toast('Категория обновлена', 'success');
      setEditTarget(null);
      load();
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setEditSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await categoriesApi.remove(deleteTarget.id);
      toast('Категория удалена', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) {
      // 409: категория используется
      toast(getApiError(e), 'danger');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      {/* ---- Создание ---- */}
      <Card className="shadow-sm mb-4">
        <Card.Header className="bg-white">
          <i className="bi bi-plus-circle me-2 text-primary" />
          <b>Новая категория</b>
        </Card.Header>
        <Card.Body>
          {createError && (
            <Alert variant="danger" className="small py-2">
              {createError}
            </Alert>
          )}
          <Form onSubmit={create}>
            <div className="d-flex flex-wrap gap-2 align-items-start">
              <Form.Control
                placeholder="Название, например «Живопись»"
                style={{ maxWidth: 280 }}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Form.Control
                placeholder="Короткое описание (необязательно)"
                style={{ flex: 1, minWidth: 220 }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Создаём…' : 'Добавить'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* ---- Список ---- */}
      {loading ? (
        <Loading text="Загружаем категории…" />
      ) : error ? (
        <ErrorAlert message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bi-tags"
          title="Категорий ещё нет"
          text="Создайте первую категорию — мастера смогут выбирать её для своих мастер-классов."
        />
      ) : (
        <Card className="shadow-sm">
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Название</th>
                <th>Описание</th>
                <th className="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="fw-semibold">{c.name}</td>
                  <td className="small text-muted">{c.description || '—'}</td>
                  <td className="text-end">
                    <div className="d-flex gap-1 justify-content-end">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        title="Редактировать"
                        onClick={() =>
                          setEditTarget({ id: c.id, name: c.name, description: c.description || '' })
                        }
                      >
                        <i className="bi bi-pencil" />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        title="Удалить"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <i className="bi bi-trash" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Alert variant="light" className="small mt-3 text-muted">
        <i className="bi bi-info-circle me-1" />
        Категорию нельзя удалить, пока к ней привязан хотя бы один мастер-класс.
      </Alert>

      {/* ---- Редактирование ---- */}
      <Modal
        show={!!editTarget}
        onHide={() => setEditTarget(null)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">Редактирование категории</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Название</Form.Label>
            <Form.Control
              value={editTarget?.name || ''}
              onChange={(e) =>
                setEditTarget((t) => (t ? { ...t, name: e.target.value } : t))
              }
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Описание</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={editTarget?.description || ''}
              onChange={(e) =>
                setEditTarget((t) => (t ? { ...t, description: e.target.value } : t))
              }
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditTarget(null)}>
            Отмена
          </Button>
          <Button variant="primary" onClick={saveEdit} disabled={editSaving}>
            {editSaving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={!!deleteTarget}
        title="Удалить категорию?"
        body={
          deleteTarget && (
            <p className="mb-0">
              Категория <b>«{deleteTarget.name}»</b> будет удалена безвозвратно.
            </p>
          )
        }
        confirmText="Удалить"
        variant="danger"
        loading={deleteLoading}
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
