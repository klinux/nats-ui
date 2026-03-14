import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TopicState {
  customTopics: string[];
  selectedTopic: string | null;
  hideInbox: boolean;
}

interface TopicActions {
  addCustomTopic: (name: string) => void;
  removeCustomTopic: (name: string) => void;
  isCustomTopic: (name: string) => boolean;
  setSelectedTopic: (topic: string | null) => void;
  setHideInbox: (hide: boolean) => void;
  toggleHideInbox: () => void;
}

export const useTopicStore = create<TopicState & TopicActions>()(
  persist(
    (set, get) => ({
      customTopics: [],
      selectedTopic: null,
      hideInbox: true,

      addCustomTopic: (name: string) => {
        const { customTopics } = get();
        if (!customTopics.includes(name)) {
          set({ customTopics: [...customTopics, name].sort() });
        }
      },

      removeCustomTopic: (name: string) => {
        set((state) => ({
          customTopics: state.customTopics.filter((t) => t !== name),
          selectedTopic: state.selectedTopic === name ? null : state.selectedTopic,
        }));
      },

      isCustomTopic: (name: string) => {
        return get().customTopics.includes(name);
      },

      setSelectedTopic: (topic: string | null) => {
        set({ selectedTopic: topic });
      },

      setHideInbox: (hide: boolean) => {
        set({ hideInbox: hide });
      },

      toggleHideInbox: () => {
        set((state) => ({ hideInbox: !state.hideInbox }));
      },
    }),
    {
      name: 'nats-ui-topics',
      partialize: (state) => ({
        customTopics: state.customTopics,
        hideInbox: state.hideInbox,
      }),
    },
  ),
);
