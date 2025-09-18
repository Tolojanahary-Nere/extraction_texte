import React, { useState, useEffect } from 'react';
import { View, Text, Image, Button, ScrollView, StyleSheet, Alert, Platform, Clipboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system/legacy'; // Using legacy API
import * as Sharing from 'expo-sharing';

const App = () => {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [activeSection, setActiveSection] = useState('upload');

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to pick images.');
      }
      fetchHistory();
    })();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImage(uri);
      uploadImage(uri);
    }
  };

  const uploadImage = async (uri) => {
    const formData = new FormData();
    formData.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    });

    try {
      const response = await fetch('https://fastapi-ocr-8b6j.onrender.com/ocr/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();
      setResult(data);
      fetchHistory();
    } catch (error) {
      Alert.alert('Error', `Failed to upload image: ${error.message}`);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('https://fastapi-ocr-8b6j.onrender.com/history/');
      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch history. Check backend connection.');
    }
  };

  const deleteHistoryItem = async (id) => {
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer cet élément de l\'historique ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`https://fastapi-ocr-8b6j.onrender.com/history/${id}`, {
                method: 'DELETE',
              });
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Échec de la suppression');
              }
              const data = await response.json();
              // Mettre à jour l'historique localement
              setHistory(history.filter(item => item.id !== id));
              Alert.alert('Succès', data.message || 'Élément supprimé avec succès !');
            } catch (error) {
              Alert.alert('Erreur', `Échec de la suppression : ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const exportData = async () => {
    try {
      const response = await fetch(`https://fastapi-ocr-8b6j.onrender.com/export/${selectedFormat}`, {
        method: 'GET',
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const fileName = `ocr_results.${selectedFormat}`;
      const downloadPath = `${FileSystem.documentDirectory}Downloads/${fileName}`; // Suggested path

      if (Platform.OS === 'web') {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      } else {
        // For mobile (Android/iOS), use downloadAsync with legacy API
        const downloadRes = await FileSystem.downloadAsync(
          response.url,
          downloadPath,
          {
            headers: {
              'Content-Type': response.headers.get('content-type'),
            },
            md5: true, // Optional: for integrity check
          }
        );

        if (downloadRes.status === 200) {
          Alert.alert('Success', `File saved to: ${downloadRes.uri}`);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadRes.uri);
          }
        } else {
          throw new Error(`Download failed with status: ${downloadRes.status}`);
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to export data: ${error.message}`);
    }
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Text has been copied to clipboard!');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://via.placeholder.com/50' }}
          style={styles.logo}
        />
        <ScrollView horizontal style={styles.menu}>
          <Text
            style={[styles.menuItem, activeSection === 'upload' && styles.activeMenuItem]}
            onPress={() => setActiveSection('upload')}
          >
            Upload
          </Text>
          <Text
            style={[styles.menuItem, activeSection === 'history' && styles.activeMenuItem]}
            onPress={() => setActiveSection('history')}
          >
            History
          </Text>
          <Text
            style={[styles.menuItem, activeSection === 'export' && styles.activeMenuItem]}
            onPress={() => setActiveSection('export')}
          >
            Export
          </Text>
        </ScrollView>
      </View>

      <View style={styles.content}>
        {activeSection === 'upload' && (
          <>
            <Button title="Pick an Image" onPress={pickImage} color="#6200EE" />
            {image && <Image source={{ uri: image }} style={styles.image} />}
            {result && (
              <View style={styles.result}>
                <Text style={styles.resultText}>ID: {result.id}</Text>
                <Text style={styles.resultText}>Filename: {result.filename}</Text>
                <Text style={styles.resultText}>Text: {result.text}</Text>
                <Button title="Copy Text" onPress={() => copyToClipboard(result.text)} color="#6200EE" />
              </View>
            )}
          </>
        )}
        {activeSection === 'history' && (
          <View style={styles.history}>
            <Text style={styles.subtitle}>History</Text>
            {history.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <Text style={styles.historyText}>{item.filename} - {item.text.substring(0, 20)}...</Text>
                <View style={styles.buttonsContainer}>
                  <Button title="Copy Text" onPress={() => copyToClipboard(item.text)} color="#6200EE" />
                  <Button title="Delete" onPress={() => deleteHistoryItem(item.id)} color="#FF0000" />
                </View>
              </View>
            ))}
          </View>
        )}
        {activeSection === 'export' && (
          <View style={styles.export}>
            <Picker
              selectedValue={selectedFormat}
              onValueChange={(itemValue) => setSelectedFormat(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="CSV" value="csv" />
              <Picker.Item label="JSON" value="json" />
              <Picker.Item label="PDF" value="pdf" />
            </Picker>
            <Button title="Export" onPress={exportData} color="#6200EE" />
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 10, backgroundColor: '#6200EE', flexDirection: 'row', alignItems: 'center' },
  logo: { width: 50, height: 50, marginRight: 10 },
  menu: { flexDirection: 'row' },
  menuItem: { padding: 10, color: '#fff', fontSize: 16, marginHorizontal: 5 },
  activeMenuItem: { fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: '#fff' },
  content: { padding: 20 },
  image: { width: '100%', height: 200, marginVertical: 10 },
  result: { marginVertical: 10, padding: 10, backgroundColor: '#fff', borderRadius: 8 },
  resultText: { fontSize: 16 },
  history: { marginVertical: 10 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  historyItem: { 
    padding: 10, 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    marginBottom: 5, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  historyText: { flex: 1, marginRight: 10 },
  buttonsContainer: { flexDirection: 'row', gap: 5 },
  export: { marginVertical: 10 },
  picker: { height: 50, width: '100%', backgroundColor: '#fff', borderRadius: 8 },
});

export default App;