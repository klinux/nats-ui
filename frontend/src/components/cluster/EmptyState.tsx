interface EmptyStateProps {
  icon: React.ElementType;
  message: string;
}

export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground text-center max-w-md">{message}</p>
    </div>
  );
}
