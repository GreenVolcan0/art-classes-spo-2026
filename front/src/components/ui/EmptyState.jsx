/**
 * Заглушка «раздел пуст» с иконкой, заголовком и необязательным действием.
 */
export default function EmptyState({ icon = 'bi-inbox', title = 'Пока пусто', text, action }) {
  return (
    <div className="text-center py-5 my-3">
      <i className={`bi ${icon} display-3 text-secondary opacity-50`} />
      <h5 className="mt-3 text-secondary">{title}</h5>
      {text && <p className="text-muted mx-auto mb-3" style={{ maxWidth: 480 }}>{text}</p>}
      {action}
    </div>
  );
}
