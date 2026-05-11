import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Message, Role, ROLE_COLORS } from '../utils/types';
import { wsClient } from '../utils/websocket';

interface ThreadViewProps {
  artifactId: string;
  messages: Message[];
  currentUser: string;
  currentRole: Role;
  onSendMessage: (content: string) => void;
  onFilePick?: () => void;
  typingUsers?: string[];
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  artifactId,
  messages,
  currentUser,
  currentRole,
  onSendMessage,
  onFilePick,
  typingUsers = [],
}) => {
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSubmit = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    wsClient.sendTyping(artifactId);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.message, { borderLeftColor: ROLE_COLORS[item.role] || '#999' }]}>
      <View style={styles.messageHeader}>
        <Text style={[styles.messageAuthor, { color: ROLE_COLORS[item.role] || '#999' }]}>
          {item.author}
        </Text>
        <Text style={styles.messageRole}>{item.role}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={styles.messageContent}>{item.content}</Text>
      {item.attachments && item.attachments.length > 0 && (
        <View style={styles.attachmentRow}>
          {item.attachments.map((att, i) => (
            <Image key={i} source={{ uri: att }} style={styles.attachment} />
          ))}
        </View>
      )}
      {item.mentions && item.mentions.length > 0 && (
        <Text style={styles.mentions}>
          @{item.mentions.join(', @')}
        </Text>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>~</Text>
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>Start the conversation about this artifact</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {typingUsers.length > 0 && (
        <Text style={styles.typingIndicator}>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </Text>
      )}

      <View style={styles.inputBar}>
        {onFilePick && (
          <TouchableOpacity onPress={onFilePick} style={styles.attachButton}>
            <Text style={styles.attachText}>+</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder="Ask a question, give feedback, or clarify..."
          placeholderTextColor="#999"
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          disabled={!inputText.trim()}
        >
          <Text style={[styles.sendText, !inputText.trim() && styles.sendTextDisabled]}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  listContent: {
    padding: 12,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#2A2A40',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5C5C78',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#3A3A50',
    textAlign: 'center',
  },
  message: {
    backgroundColor: 'rgba(20, 20, 30, 0.85)',
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  messageAuthor: {
    fontWeight: '700',
    fontSize: 13,
  },
  messageRole: {
    fontSize: 11,
    color: '#9E9EB8',
    backgroundColor: '#1C1C2E',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#5C5C78',
    marginLeft: 'auto',
  },
  messageContent: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  attachmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  attachment: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  mentions: {
    fontSize: 12,
    color: '#7C5CFC',
    marginTop: 4,
  },
  typingIndicator: {
    fontSize: 12,
    color: '#5C5C78',
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#2A2A40',
    backgroundColor: '#14141E',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    gap: 8,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachText: {
    fontSize: 20,
    color: '#9E9EB8',
    fontWeight: '300',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2A40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#FFFFFF',
    backgroundColor: '#1C1C2E',
  },
  sendButton: {
    backgroundColor: '#7C5CFC',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#2A2A40',
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sendTextDisabled: {
    color: '#5C5C78',
  },
});
