export function ActivityList({
  items,
}: {
  items: { entity_type: string; entity_id: string; title_he: string; occurred_at: string }[];
}) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-lg font-semibold text-fg">
        פעילות
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={`${item.entity_type}-${item.entity_id}-${item.occurred_at}`} className="text-sm text-fg">
            {item.title_he}
          </li>
        ))}
      </ul>
    </section>
  );
}
