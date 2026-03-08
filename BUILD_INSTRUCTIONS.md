# ElderlyCare Meds - Android APK Build Instructions

Follow these steps to build the Android APK for your application.

## 1. Prerequisites
- **Node.js**: Ensure you have Node.js installed on your computer.
- **Android Studio**: Download and install Android Studio.
- **Java JDK**: Android Studio usually comes with an embedded JDK.

## 2. Download and Prepare the Code
1. Click the **Download** icon in the top-right corner of the AI Studio interface to download the project as a ZIP file.
2. Extract the ZIP file to a folder on your computer.
3. Open a terminal (Command Prompt, PowerShell, or Terminal) and navigate to the extracted folder.

## 3. Install Dependencies and Build
Run the following commands in your terminal:

```bash
# Install all required packages
npm install

# Ensure Capacitor CLI is available
npm install -D @capacitor/cli

# Build the web application
npm run build

# Synchronize the code with the Android project
npx @capacitor/cli sync android
```

## 4. Open in Android Studio
Run this command to open the project in Android Studio:

```bash
npx @capacitor/cli open android
```

## 5. Generate the APK in Android Studio
1. Wait for Android Studio to finish indexing and syncing Gradle (watch the progress bar at the bottom).
2. **Fix JDK Error (if it appears)**: If you see an error about "Invalid Gradle JDK", click the blue link that says **"Use Embedded JDK"** or **"Change JDK location"** in the error message.
3. **Build the APK**:
   - Go to the top menu: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
4. **Locate the APK**:
   - Once the build is finished, a notification will appear in the bottom-right corner.
   - Click the **locate** link in that notification to open the folder containing your `app-debug.apk` file.

## 6. Install on Phone
- Transfer the `app-debug.apk` file to your Android phone.
- Open the file on your phone to install it (you may need to allow "Install from unknown sources" in your phone settings).

## 7. Troubleshooting Reminders & Sound
If you don't hear the reminder sound or see popups:
1. **Check Notification Volume**: Ensure your phone's "Notification" or "Ring" volume is turned up.
2. **Check "Do Not Disturb"**: Make sure your phone is not in "Do Not Disturb" mode.
3. **App Permissions**: On your phone, go to **Settings > Apps > ElderlyCare Meds > Notifications** and ensure:
   - "Allow Notifications" is ON.
   - "Medication Reminders" channel is set to **"Alerting"** or **"High"** importance.
   - "Allow sound and vibration" is enabled.
4. **Battery Optimization**: Some phones (like Samsung/Xiaomi) kill background apps. Go to **Settings > Apps > ElderlyCare Meds > Battery** and set it to **"Unrestricted"** for the most reliable reminders.

---
*Note: I have configured a "High Importance" channel that forces the phone to show a "Heads-up" popup and play the default system sound even when locked.*
