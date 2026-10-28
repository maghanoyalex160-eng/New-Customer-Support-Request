import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Technical Issue');
  const [message, setMessage] = useState('');
  const [imageUri, setImageUri] = useState(null);

  // UI State
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Categories list
  const categories = ['Account Problem', 'Technical Issue', 'Payment Concern', 'Other'];

  // 1. Pick Image from Gallery
  const pickImage = async () => {
    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'You need to grant camera roll permissions to upload a screenshot.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // 2. Upload Image to Cloudinary (Fixed for Web & Mobile compatibility)
  const uploadToCloudinary = async (uri) => {
    const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary environment variables are missing.');
    }

    const data = new FormData();

    // Suporta para sa Web at Mobile (Android/iOS)
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      const blob = await res.blob();
      data.append('file', blob, 'support_screenshot.jpg');
    } else {
      data.append('file', {
        uri: uri,
        type: 'image/jpeg',
        name: 'support_screenshot.jpg',
      });
    }

    data.append('upload_preset', uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: data,
    });

    const fileData = await response.json();
    if (!response.ok) {
      throw new Error(fileData.error?.message || 'Image upload failed');
    }

    return fileData.secure_url;
  };

  // 3. Send Email via EmailJS REST API
  const sendEmailWithEmailJS = async (imageUrl) => {
    const serviceId = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      throw new Error('EmailJS environment variables are missing.');
    }

    const templateParams = {
      name: name,
      reply_to: email,
      issue_category: category,
      message: message,
      image_url: imageUrl || 'No screenshot provided',
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: templateParams,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Email sending failed: ${errorText}`);
    }

    return true;
  };

  // 4. Handle Form Submission Workflow
  const handleSubmit = async () => {
    // Validation
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert('Validation Error', 'Please fill out all required text fields.');
      return;
    }

    setLoading(true);
    setStatusMessage('Preparing submission...');

    try {
      let imageUrl = '';

      // Step A: Upload image if selected
      if (imageUri) {
        setStatusMessage('Uploading screenshot to Cloudinary...');
        imageUrl = await uploadToCloudinary(imageUri);
      }

      // Step B: Send support email via EmailJS
      setStatusMessage('Sending support email...');
      await sendEmailWithEmailJS(imageUrl);

      Alert.alert('Success!', 'Your support request has been submitted successfully.');
      
      // Reset Form
      setName('');
      setEmail('');
      setMessage('');
      setImageUri(null);
      setStatusMessage('');
    } catch (error) {
      console.error(error);
      Alert.alert('Submission Error', error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.headerTitle}>Customer Support</Text>
        <Text style={styles.headerSubtitle}>We are here to help you solve any issues.</Text>

        {/* Name Input */}
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor="#888"
          value={name}
          onChangeText={setName}
        />

        {/* Email Input */}
        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email address"
          placeholderTextColor="#888"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        {/* Issue Category Selection */}
        <Text style={styles.label}>Issue Category</Text>
        <View style={styles.categoryContainer}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryButton, category === cat && styles.categorySelected]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryText, category === cat && styles.categoryTextSelected]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Message Input */}
        <Text style={styles.label}>Message / Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your issue in detail..."
          placeholderTextColor="#888"
          multiline={true}
          numberOfLines={4}
          value={message}
          onChangeText={setMessage}
        />

        {/* Screenshot Upload Section */}
        <Text style={styles.label}>Screenshot (Optional)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>
            {imageUri ? 'Change Screenshot' : 'Select Screenshot from Gallery'}
          </Text>
        </TouchableOpacity>

        {imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <TouchableOpacity style={styles.removeButton} onPress={() => setImageUri(null)}>
              <Text style={styles.removeButtonText}>Remove Image</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Submit Button & Status Indicator */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>{statusMessage}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit Request</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 25,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  categorySelected: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  categoryText: {
    fontSize: 13,
    color: '#333',
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#e5edff',
    borderWidth: 1,
    borderColor: '#b3d1ff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#0066CC',
    fontWeight: '600',
    fontSize: 14,
  },
  previewContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#0066CC',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#555',
    fontSize: 14,
  },
});