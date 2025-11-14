const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('fr-FR', DATE_OPTIONS);
}

