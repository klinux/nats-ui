import { describe, it, expect, beforeEach } from 'vitest';
import { useTopicStore } from './topic-store';

const initialState = useTopicStore.getState();

describe('topic-store', () => {
  beforeEach(() => {
    useTopicStore.setState(initialState, true);
  });

  describe('addCustomTopic', () => {
    it('adds a topic and sorts the list', () => {
      useTopicStore.getState().addCustomTopic('zebra');
      useTopicStore.getState().addCustomTopic('alpha');

      expect(useTopicStore.getState().customTopics).toEqual(['alpha', 'zebra']);
    });

    it('does not add duplicate topics', () => {
      useTopicStore.getState().addCustomTopic('orders');
      useTopicStore.getState().addCustomTopic('orders');

      expect(useTopicStore.getState().customTopics).toEqual(['orders']);
    });
  });

  describe('removeCustomTopic', () => {
    it('removes a topic from the list', () => {
      useTopicStore.setState({ customTopics: ['a', 'b', 'c'] });
      useTopicStore.getState().removeCustomTopic('b');

      expect(useTopicStore.getState().customTopics).toEqual(['a', 'c']);
    });

    it('clears selectedTopic if the removed topic was selected', () => {
      useTopicStore.setState({ customTopics: ['a', 'b'], selectedTopic: 'b' });
      useTopicStore.getState().removeCustomTopic('b');

      expect(useTopicStore.getState().selectedTopic).toBeNull();
    });

    it('keeps selectedTopic if a different topic was removed', () => {
      useTopicStore.setState({ customTopics: ['a', 'b'], selectedTopic: 'a' });
      useTopicStore.getState().removeCustomTopic('b');

      expect(useTopicStore.getState().selectedTopic).toBe('a');
    });
  });

  describe('isCustomTopic', () => {
    it('returns true for existing custom topics', () => {
      useTopicStore.setState({ customTopics: ['events'] });

      expect(useTopicStore.getState().isCustomTopic('events')).toBe(true);
    });

    it('returns false for non-existent topics', () => {
      useTopicStore.setState({ customTopics: [] });

      expect(useTopicStore.getState().isCustomTopic('events')).toBe(false);
    });
  });

  describe('setSelectedTopic', () => {
    it('updates the selected topic', () => {
      useTopicStore.getState().setSelectedTopic('orders');

      expect(useTopicStore.getState().selectedTopic).toBe('orders');
    });

    it('can set to null', () => {
      useTopicStore.setState({ selectedTopic: 'orders' });
      useTopicStore.getState().setSelectedTopic(null);

      expect(useTopicStore.getState().selectedTopic).toBeNull();
    });
  });

  describe('toggleHideInbox', () => {
    it('toggles hideInbox from true to false', () => {
      useTopicStore.setState({ hideInbox: true });
      useTopicStore.getState().toggleHideInbox();

      expect(useTopicStore.getState().hideInbox).toBe(false);
    });

    it('toggles hideInbox from false to true', () => {
      useTopicStore.setState({ hideInbox: false });
      useTopicStore.getState().toggleHideInbox();

      expect(useTopicStore.getState().hideInbox).toBe(true);
    });
  });
});
