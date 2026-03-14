import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';

import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNats } from '../hooks/useNats';
import { useTopics } from '../hooks/useTopics';
import { useMessages } from '../hooks/useMessages';
import { useTopicStore } from '../stores/topic-store';
import { TopicList } from '../components/messages/TopicList';
import { MessageList } from '../components/messages/MessageList';
import { PublishForm } from '../components/messages/PublishForm';
import { RequestReplyPanel } from '../components/messages/RequestReplyPanel';
import { AddTopicDialog } from '../components/messages/AddTopicDialog';

export function Messages() {
  const { connection, isConnected } = useNats();
  const selectedTopic = useTopicStore((s) => s.selectedTopic);
  const setSelectedTopic = useTopicStore((s) => s.setSelectedTopic);
  const hideInbox = useTopicStore((s) => s.hideInbox);
  const toggleHideInbox = useTopicStore((s) => s.toggleHideInbox);

  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [publishExpanded, setPublishExpanded] = useState(true);
  const [requestExpanded, setRequestExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');

  const {
    topics,
    isLoading: isLoadingTopics,
    activities,
    refresh: refreshTopics,
    addCustomTopic,
  } = useTopics({ isConnected });

  const {
    isSubscribed,
    toggleSubscription,
    clearMessages,
    getFilteredMessages,
    exportMessages,
  } = useMessages(connection);

  // Responsive collapse
  useEffect(() => {
    const handleResize = () => setPublishExpanded(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAddTopic = (name: string) => {
    addCustomTopic(name);
    setSelectedTopic(name);
  };

  if (!isConnected) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-3xl font-bold">Topics</h1>
          <p className="text-muted-foreground">
            Connect to NATS server to manage topics and messages
          </p>
        </div>
      </div>
    );
  }

  const filteredMessages = selectedTopic ? getFilteredMessages(selectedTopic) : [];

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Topics</h1>
          <p className="text-sm text-muted-foreground">
            Browse subjects, publish messages, and perform request-reply
          </p>
        </div>
      </div>

      <div className="flex-1 lg:grid lg:grid-cols-12 gap-4 lg:min-h-0 lg:max-h-[calc(100vh-10rem)]">
        {/* Topic List — 3 cols */}
        <div className="lg:col-span-3 flex flex-col min-h-0 mb-4 lg:mb-0">
          <TopicList
            topics={topics}
            activities={activities}
            selectedTopic={selectedTopic}
            isLoading={isLoadingTopics}
            isSubscribedFn={isSubscribed}
            onSelect={setSelectedTopic}
            onRefresh={refreshTopics}
            onAddTopic={() => setIsAddTopicOpen(true)}
            hideInbox={hideInbox}
            onToggleInbox={toggleHideInbox}
          />
        </div>

        {/* Topic Detail — 9 cols */}
        <div className="lg:col-span-9 flex flex-col min-h-0">
          {!selectedTopic ? (
            <Card className="flex-1 flex flex-col">
              <CardContent className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                  <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Select a Topic</h3>
                    <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                      Choose a topic from the list to view messages, publish, or perform request-reply
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-shrink-0">
                <TabsList className="h-8">
                  <TabsTrigger value="messages" className="text-xs h-7">Messages</TabsTrigger>
                  <TabsTrigger value="publish" className="text-xs h-7">Publish</TabsTrigger>
                  <TabsTrigger value="request" className="text-xs h-7">Request-Reply</TabsTrigger>
                </TabsList>

                <TabsContent value="publish" className="mt-3">
                  <PublishForm
                    topic={selectedTopic}
                    connection={connection}
                    isExpanded={publishExpanded}
                    onToggle={setPublishExpanded}
                  />
                </TabsContent>

                <TabsContent value="request" className="mt-3">
                  <RequestReplyPanel
                    topic={selectedTopic}
                    isExpanded={requestExpanded}
                    onToggle={setRequestExpanded}
                  />
                </TabsContent>

                <TabsContent value="messages" className="mt-3 flex-1 flex flex-col min-h-0">
                  <MessageList
                    topic={selectedTopic}
                    messages={filteredMessages}
                    isSubscribed={isSubscribed(selectedTopic)}
                    onToggleSubscription={() => toggleSubscription(selectedTopic)}
                    onClear={() => clearMessages(selectedTopic)}
                    onExport={() => exportMessages(selectedTopic)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      <AddTopicDialog
        open={isAddTopicOpen}
        onOpenChange={setIsAddTopicOpen}
        onAdd={handleAddTopic}
      />
    </div>
  );
}
