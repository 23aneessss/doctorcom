import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/colors';

interface Tag {
  id?: string;
  name: string;
  color?: string;
}

interface NoteCardProps {
  id: string;
  title?: string;
  content: string;
  tags: string[];
  isPinned?: boolean;
  createdAt: string;
  onPress?: () => void;
  onPinToggle?: () => void;
}

export function NoteCard({
  title,
  content,
  tags,
  isPinned,
  createdAt,
  onPress,
  onPinToggle,
}: NoteCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const tagColors = [
    colors.accent.teal,
    colors.accent.orange,
    colors.accent.green,
    colors.accent.purple,
    colors.accent.pink,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.container}
    >
      <View style={styles.header}>
        {title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        {onPinToggle && (
          <TouchableOpacity onPress={onPinToggle} style={styles.pinButton}>
            <Ionicons
              name={isPinned ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isPinned ? colors.accent.orange : colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.content} numberOfLines={3}>
        {content}
      </Text>
      <View style={styles.footer}>
        <View style={styles.tags}>
          {tags.slice(0, 3).map((tag, index) => (
            <View
              key={tag}
              style={[
                styles.tag,
                { backgroundColor: `${tagColors[index % tagColors.length]}15` },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: tagColors[index % tagColors.length] },
                ]}
              >
                {tag}
              </Text>
            </View>
          ))}
          {tags.length > 3 && (
            <Text style={styles.moreTags}>+{tags.length - 3}</Text>
          )}
        </View>
        <Text style={styles.date}>{formatDate(createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  pinButton: {
    padding: 4,
  },
  content: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 12,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreTags: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    marginLeft: 4,
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
});
