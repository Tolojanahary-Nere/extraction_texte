import React, { useState, useEffect } from 'react';
import { View, Text, Image, Button, ScrollView, StyleSheet, Alert, Platform, Clipboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
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

  const exportData = async () => {
    try {
      const response = await fetch(`https://fastapi-ocr-8b6j.onrender.com/export/${selectedFormat}`);
      if (!response.ok) throw new Error('Export failed');

      if (Platform.OS === 'web') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ocr_results.${selectedFormat}`;
        a.click();
      } else {
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onload = async () => {
          const base64Data = reader.result.split(',')[1];
          const fileUri = FileSystem.documentDirectory + `ocr_results.${selectedFormat}`;

          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
          } else {
            Alert.alert('Saved', `File saved to: ${fileUri}`);
          }
        };

        reader.readAsDataURL(blob);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data. Check backend connection.');
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
                <Text>{item.filename} - {item.text.substring(0, 20)}...</Text>
                <Button title="Copy Text" onPress={() => copyToClipboard(item.text)} color="#6200EE" />
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
  historyItem: { padding: 10, backgroundColor: '#fff', borderRadius: 8, marginBottom: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  export: { marginVertical: 10 },
  picker: { height: 50, width: '100%', backgroundColor: '#fff', borderRadius: 8 },
});

export default App;