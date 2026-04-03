import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { NoteCard, Card, Button, Input, LoadingSpinner, EmptyState } from '../components/ui';
import { colors } from '../utils/colors';
import { trpc } from '../api/trpc';
import { useAuthStore } from '../stores/authStore';

const PREDEFINED_TAGS = [
  { name: 'diagnostic', label: 'Diagnostic', color: colors.accent.teal },
  { name: 'rappel', label: 'Rappel', color: colors.accent.orange },
  { name: 'protocole', label: 'Protocole', color: colors.accent.green },
  { name: 'traitement', label: 'Traitement', color: colors.accent.purple },
  { name: 'formation', label: 'Formation', color: colors.accent.pink },
  { name: 'idee', label: 'Idee', color: colors.accent.yellow },
];

export default function MemoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ create?: string }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: [] as string[] });

  useEffect(() => {
    if (params.create === '1') {
      setShowCreateModal(true);
    }
  }, [params.create]);

  // Fetch notes
  const { data: notes, isLoading, refetch } = trpc.mobile.memory.getNotes.useQuery({
    search: searchQuery || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  }, { enabled: isAuthenticated });

  // Fetch user tags
  const { data: userTags } = trpc.mobile.memory.getTags.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Mutations
  const createNoteMutation = trpc.mobile.memory.createNote.useMutation({
    onSuccess: () => {
      setShowCreateModal(false);
      setNewNote({ title: '', content: '', tags: [] });
      refetch();
    },
    onError: (error) => {
      Alert.alert('Erreur', error.message);
    },
  });

  const togglePinMutation = trpc.mobile.memory.togglePin.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const deleteNoteMutation = trpc.mobile.memory.deleteNote.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleNewNoteTagToggle = (tag: string) => {
    setNewNote(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleCreateNote = () => {
    if (!newNote.content.trim()) {
      Alert.alert('Erreur', 'Le contenu de la note est requis');
      return;
    }
    createNoteMutation.mutate({
      title: newNote.title || undefined,
      content: newNote.content,
      tags: newNote.tags,
    });
  };

  const handleDeleteNote = (id: string) => {
    Alert.alert(
      'Supprimer la note',
      'Êtes-vous sûr de vouloir supprimer cette note ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: () => deleteNoteMutation.mutate({ id }),
        },
      ]
    );
  };

  const pinnedNotes = notes?.filter(n => n.isPinned) || [];
  const regularNotes = notes?.filter(n => !n.isPinned) || [];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#0F3460', '#123865', '#285487']}
          locations={[0.3, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Memory</Text>
              <Text style={styles.headerSubtitle}>Votre cerveau numérique</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={24} color="#0F3460" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une note..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagsScroll}
          >
            {PREDEFINED_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag.name}
                style={[
                  styles.tagButton,
                  selectedTags.includes(tag.name) && { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
                ]}
              onPress={() => handleToggleTag(tag.name)}
            >
              <Text
                style={[
                  styles.tagButtonText,
                  selectedTags.includes(tag.name) && styles.tagButtonTextActive,
                ]}
              >
                {tag.label}
              </Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
          <LinearGradient colors={['transparent', 'rgba(255, 255, 255, 0.05)']} style={styles.bottomFade} />
        </LinearGradient>

        <View style={styles.content}>
          {isLoading ? (
            <LoadingSpinner />
          ) : notes && notes.length > 0 ? (
            <>
              {pinnedNotes.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="bookmark" size={18} color={colors.accent.orange} />
                    <Text style={styles.sectionTitle}>Épinglées</Text>
                  </View>
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      id={note.id}
                      title={note.title ?? undefined}
                      content={note.content ?? ''}
                      tags={note.tags}
                      isPinned={note.isPinned}
                      createdAt={note.createdAt}
                      onPress={() => router.push(`/notes/${note.id}` as never)}
                      onPinToggle={() => togglePinMutation.mutate({ id: note.id })}
                    />
                  ))}
                </View>
              )}

              {regularNotes.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="document-text-outline" size={18} color={colors.text.secondary} />
                    <Text style={styles.sectionTitle}>Toutes les notes</Text>
                    <Text style={styles.noteCount}>{regularNotes.length}</Text>
                  </View>
                  {regularNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      id={note.id}
                      title={note.title ?? undefined}
                      content={note.content ?? ''}
                      tags={note.tags}
                      isPinned={note.isPinned}
                      createdAt={note.createdAt}
                      onPress={() => router.push(`/notes/${note.id}` as never)}
                      onPinToggle={() => togglePinMutation.mutate({ id: note.id })}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <EmptyState
              icon="document-text-outline"
              title="Aucune note"
              description="Créez votre première note pour commencer à organiser vos idées"
              actionLabel="Créer une note"
              onAction={() => setShowCreateModal(true)}
            />
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
      >
        <View style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* Create Note Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle note</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                <Input
                  value={newNote.title}
                  onChangeText={(text) => setNewNote(prev => ({ ...prev, title: text }))}
                  placeholder="Titre (optionnel)"
                  label="Titre"
                />

                <Text style={styles.inputLabel}>Contenu</Text>
                <TextInput
                  style={styles.contentInput}
                  placeholder="Écrivez votre note ici..."
                  placeholderTextColor={colors.text.tertiary}
                  value={newNote.content}
                  onChangeText={(text) => setNewNote(prev => ({ ...prev, content: text }))}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />

                <Text style={styles.inputLabel}>Tags</Text>
                <View style={styles.tagsGrid}>
                  {PREDEFINED_TAGS.map((tag) => (
                    <TouchableOpacity
                      key={tag.name}
                      style={[
                        styles.tagOption,
                        newNote.tags.includes(tag.name) && { 
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                        },
                        ]}
                        onPress={() => handleNewNoteTagToggle(tag.name)}
                      >
                        <Text
                          style={[
                            styles.tagOptionText,
                            newNote.tags.includes(tag.name) && { color: tag.color },
                          ]}
                        >
                          {tag.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreateNote}
                  disabled={createNoteMutation.isPending}
                >
                  {createNoteMutation.isPending ? (
                    <LoadingSpinner color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.createButtonText}>Créer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#0F3460',
    paddingHorizontal: 24,
    paddingBottom: 22,
    borderBottomLeftRadius: 36, // Deeper border radius for premium feel
    borderBottomRightRadius: 36,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 10,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    fontWeight: '500',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 10,
    fontWeight: '500',
  },
  tagsScroll: {
    flexDirection: 'row',
  },
  tagButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 8,
    marginTop: 8,
  },
  tagButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tagButtonTextActive: {
    color: '#0F3460',
  },
  content: {
    padding: 24,
    paddingTop: 30,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    letterSpacing: -0.3,
  },
  noteCount: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 'auto',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    zIndex: 999,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F3460',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.tertiary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 8,
    marginTop: 8,
  },
  contentInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text.primary,
    minHeight: 120,
    borderWidth: 2,
    borderColor: colors.background.tertiary,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tagOptionText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.background.tertiary,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  createButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary[800],
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
