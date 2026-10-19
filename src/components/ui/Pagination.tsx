interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  return (
    <div className="pagination">
      <button
        type="button"
        className="btn btn-ghost"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        السابق
      </button>
      <span>
        صفحة {page} من {pages}
      </span>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        التالي
      </button>
    </div>
  );
}
