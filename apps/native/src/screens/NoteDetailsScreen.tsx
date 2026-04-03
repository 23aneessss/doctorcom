import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, LoadingOverlay, LoadingSpinner } from '../components/ui';
import { PremiumHeader } from '../components/shared/PremiumHeader';
import { colors } from '../utils/colors';
import { trpc } from '../api/trpc';

const FALLBACK_TAGS = [
  { name: 'diagnostic', color: colors.accent.teal },
  { name: 'rappel', color: colors.accent.orange },
  { name: 'protocole', color: colors.accent.green },
  { name: 'traitement', color: colors.accent.purple },
  { name: 'formation', color: colors.accent.pink },
  { name: 'idee', color: colors.accent.yellow },
];

export default function NoteDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: note, isLoading } = trpc.mobile.memory.getNote.useQuery({ id: params.id });
  const { data: userTags } = trpc.mobile.memory.getTags.useQuery();

  const availableTags = useMemo(
    () => (userTags && userTags.length > 0 ? userTags : FALLBACK_TAGS),
    [userTags]
  );

  useEffect(() => {
    if (!note) {
      return;
    }

    setTitle(note.title || '');
    setContent(note.content);
    setSelectedTags(note.tags || []);
  }, [note]);

  const invalidateQueries = async () => {
    await Promise.all([
      utils.mobile.memory.getNotes.invalidate(),
      utils.mobile.memory.getNote.invalidate({ id: params.id }),
      utils.mobile.today.getQuickStats.invalidate(),
    ]);
  };

  const updateMutation = trpc.mobile.memory.updateNote.useMutation({
    onSuccess: async () => {
      await invalidateQueries();
      router.back();
    },
    onError: (error) => Alert.alert('Erreur', error.message),
  });

  const deleteMutation = trpc.mobile.memory.deleteNote.useMutation({
    onSuccess: async () => {
      await invalidateQueries();
      router.replace('/memory');
    },
    onError: (error) => Alert.alert('Erreur', error.message),
  });

  const togglePinMutation = trpc.mobile.memory.togglePin.useMutation({
    onSuccess: async () => {
      await invalidateQueries();
    },
    onError: (error) => Alert.alert('Erreur', error.message),
  });

  const handleSave = () => {
    if (!content.trim()) {
      Alert.alert('Erreur', 'Le contenu de la note est requis');
      return;
    }

    updateMutation.mutate({
      id: params.id,
      title: title.trim() || undefined,
      content: content.trim(),
      tags: selectedTags,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la note',
      'Cette action est irreversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ id: params.id }),
        },
      ]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  if (isLoading && !note) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LoadingOverlay
        visible={updateMutation.isPending || deleteMutation.isPending || togglePinMutation.isPending}
        message="Enregistrement..."
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PremiumHeader
          title="Note"
          subtitle="Editez et organisez votre memoire clinique"
          onBack={() => router.back()}
          rightAction={{ icon: 'trash-outline', onPress: handleDelete }}
        />

        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Contenu</Text>
              <TouchableOpacity
                style={[styles.pinButton, note?.isPinned && styles.pinButtonActive]}
                onPress={() => togglePinMutation.mutate({ id: params.id })}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={note?.isPinned ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={note?.isPinned ? colors.accent.orange : '#64748B'}
                />
                <Text style={[styles.pinText, note?.isPinned && styles.pinTextActive]}>
                  {note?.isPinned ? 'Epinglee' : 'Epingler'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Titre</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Titre (optionnel)"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Contenu</Text>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Ecrivez votre note ici..."
                placeholderTextColor="#94A3B8"
                style={[styles.input, styles.contentInput]}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsWrap}>
              {availableTags.map((tag) => {
                const active = selectedTags.includes(tag.name);
                return (
                  <TouchableOpacity
                    key={tag.name}
                    style={[
                      styles.tagChip,
                      active && { backgroundColor: `${tag.color}18`, borderColor: tag.color },
                    ]}
                    onPress={() => toggleTag(tag.name)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tagText, active && { color: tag.color }]}>{tag.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Button title="Enregistrer la note" onPress={handleSave} fullWidth size="lg" style={styles.saveButton} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F9',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pinButtonActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  pinText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  pinTextActive: {
    color: colors.accent.orange,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  contentInput: {
    minHeight: 180,
    paddingTop: 14,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'capitalize',
  },
  saveButton: {
    borderRadius: 18,
    backgroundColor: '#173C6B',
    marginTop: 4,
  },
});
