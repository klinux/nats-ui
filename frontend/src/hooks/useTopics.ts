import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { fetchActiveSubjects } from '../services/nats-service';
import { subjectTracker, type SubjectActivity } from '../services/subject-tracker';
import { useTopicStore } from '../stores/topic-store';

interface UseTopicsOptions {
  isConnected: boolean;
}

export function useTopics({ isConnected }: UseTopicsOptions) {
  const [serverTopics, setServerTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activities, setActivities] = useState<Map<string, SubjectActivity>>(new Map());

  const customTopics = useTopicStore((s) => s.customTopics);
  const hideInbox = useTopicStore((s) => s.hideInbox);
  const addCustomTopic = useTopicStore((s) => s.addCustomTopic);
  const removeCustomTopic = useTopicStore((s) => s.removeCustomTopic);
  const isCustomTopic = useTopicStore((s) => s.isCustomTopic);

  const serverCache = useRef<{ topics: Set<string>; timestamp: number }>({ topics: new Set(), timestamp: 0 });
  const lastHash = useRef('');

  const createHash = useCallback((arr: string[]) => arr.sort().join('|'), []);

  const mergeAll = useCallback(() => {
    const trackerTopics = subjectTracker.getSubjects().map((s) => s.subject);
    const all = Array.from(
      new Set([...serverCache.current.topics, ...trackerTopics, ...customTopics]),
    ).sort();
    const hash = createHash(all);
    if (hash !== lastHash.current) {
      lastHash.current = hash;
      setServerTopics(all);
    }
  }, [createHash, customTopics]);

  const fetchServerTopics = useCallback(async (): Promise<Set<string>> => {
    if (!isConnected) return new Set();
    const now = Date.now();
    if (now - serverCache.current.timestamp < 30000 && serverCache.current.topics.size > 0) {
      return serverCache.current.topics;
    }
    try {
      const result = await fetchActiveSubjects();
      const set = new Set(result);
      serverCache.current = { topics: set, timestamp: now };
      return set;
    } catch {
      return serverCache.current.topics;
    }
  }, [isConnected]);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    try {
      const fresh = await fetchActiveSubjects();
      serverCache.current = { topics: new Set(fresh), timestamp: Date.now() };
      mergeAll();
      toast.success('Topics refreshed');
    } catch {
      toast.error('Failed to refresh topics');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, mergeAll]);

  // Initial fetch + server polling
  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;

    const fetchAll = async () => {
      if (!cancelled) setIsLoading(true);
      try {
        await fetchServerTopics();
        if (!cancelled) mergeAll();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAll();
    const interval = setInterval(async () => {
      try {
        await fetchServerTopics();
        mergeAll();
      } catch { /* ignore */ }
    }, 30000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [isConnected, fetchServerTopics, mergeAll]);

  // Subject tracker updates (debounced)
  useEffect(() => {
    if (!isConnected) return;
    let timeout: ReturnType<typeof setTimeout>;
    let lastUpdate = 0;

    const unsub = subjectTracker.subscribe(() => {
      clearTimeout(timeout);
      const now = Date.now();
      const delay = now - lastUpdate < 2000 ? 1500 : 500;
      timeout = setTimeout(() => {
        lastUpdate = Date.now();
        mergeAll();
      }, delay);
    });

    return () => { clearTimeout(timeout); unsub(); };
  }, [isConnected, mergeAll]);

  // Re-merge when customTopics change
  useEffect(() => {
    mergeAll();
  }, [customTopics, mergeAll]);

  // Activity tracking
  useEffect(() => {
    const update = () => {
      const subjects = subjectTracker.getSubjects();
      setActivities(new Map(subjects.map((s) => [s.subject, s])));
    };
    update();
    return subjectTracker.subscribe(update);
  }, []);

  const filteredTopics = hideInbox
    ? serverTopics.filter((t) => !t.startsWith('_INBOX.'))
    : serverTopics;

  return {
    topics: filteredTopics,
    allTopics: serverTopics,
    isLoading,
    activities,
    refresh,
    addCustomTopic,
    removeCustomTopic,
    isCustomTopic,
    hideInbox,
  };
}
