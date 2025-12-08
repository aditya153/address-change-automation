import { createContext, useContext, useState, useEffect } from 'react';

// Translation strings
const translations = {
    en: {
        // Navbar
        federalRepublic: "🇩🇪 Federal Republic of Germany",
        english: "English",
        german: "Deutsch",
        help: "Help",
        contact: "Contact",
        citizenPortal: "Citizen portal",
        registrationOffice: "Residents' Registration Office - Registration",
        userPortal: "User Portal",
        adminDashboard: "Admin Dashboard",
        logout: "Log out",
        // Breadcrumb
        homepage: "Homepage",
        citizenServices: "Citizen Services",
        addressChange: "Address Change",
        contactPage: "Contact",
        // Form
        registeringApartment: "📋 Registering an apartment",
        registrationSubtitle: "Registration of Residence - Submit your documents for address change",
        personalData: "Personal Data",
        registrationCertificate: "Registration certificate",
        landlordConfirmation: "Landlord confirmation",
        note: "Note:",
        noteText: "Please upload all required documents in PDF format. The maximum file size is 10 MB.",
        emailAddress: "E-mail address",
        emailPlaceholder: "your.email@example.de",
        addressCertificate: "Registration certificate (Address Certificate)",
        landlordCertificate: "Landlord Certificate",
        dropFile: "Drop file here or",
        browse: "browse",
        pdfOnly: "PDF files only (max. 10 MB)",
        readyToUpload: "Ready to upload",
        submitApplication: "📤 SUBMIT APPLICATION",
        processing: "Processing...",
        dataEncrypted: "Your data will be transmitted in encrypted form and processed in accordance with the GDPR.",
        // Sidebar
        requiredDocuments: "📋 Required documents",
        validId: "Valid identity card or passport",
        landlordConfirmationDoc: "Landlord's confirmation",
        completedForm: "Completed registration form",
        contactHelp: "📞 Contact & Help",
        email: "e-mail",
        phone: "phone",
        openingHours: "Opening hours",
        openingTime: "Mon-Fri: 8:00 - 16:00",
        // Footer
        imprint: "Imprint",
        dataProtection: "Data protection",
        accessibility: "Accessibility",
        termsOfUse: "Terms of Use",
        copyright: "© 2025 Citizen Portal - All rights reserved",
        // Messages
        fillAllFields: "Please fill all required fields.",
        submitSuccess: "Your application has been submitted successfully. You will receive a confirmation by email.",
        submitFailed: "Submission failed. Please try again.",
        // Chatbot
        chatbotTitle: "Citizen Assistant",
        online: "● Online",
        chatPlaceholder: "Your message...",
        chatGreeting: "Hello! 👋 How can I help you with your address change today?",
        chatError: "Sorry, there is a connection problem. Please try again.",
        goodbye: "Goodbye! If you have any questions, we are happy to help.",
        // Contact Page
        contactTitle: "📞 Contact Us",
        contactSubtitle: "Get in touch with our support team",
        yourName: "Your Name",
        namePlaceholder: "Enter your full name",
        subject: "Subject",
        subjectPlaceholder: "What is this about?",
        message: "Message",
        messagePlaceholder: "Write your message here...",
        sendMessage: "📤 SEND MESSAGE",
        sending: "Sending...",
        messageSent: "Your message has been sent successfully!",
        messageFailed: "Failed to send message. Please try again.",
        backToPortal: "← Back to Portal"
    },
    de: {
        // Navbar
        federalRepublic: "🇩🇪 Bundesrepublik Deutschland",
        english: "English",
        german: "Deutsch",
        help: "Hilfe",
        contact: "Kontakt",
        citizenPortal: "Bürgerportal",
        registrationOffice: "Einwohnermeldeamt - Anmeldung",
        userPortal: "Benutzerportal",
        adminDashboard: "Admin Dashboard",
        logout: "Abmelden",
        // Breadcrumb
        homepage: "Startseite",
        citizenServices: "Bürgerservice",
        addressChange: "Adressänderung",
        contactPage: "Kontakt",
        // Form
        registeringApartment: "📋 Anmeldung einer Wohnung",
        registrationSubtitle: "Anmeldung des Wohnsitzes - Reichen Sie Ihre Dokumente für die Adressänderung ein",
        personalData: "Persönliche Daten",
        registrationCertificate: "Meldebescheinigung",
        landlordConfirmation: "Wohnungsgeberbestätigung",
        note: "Hinweis:",
        noteText: "Bitte laden Sie alle erforderlichen Dokumente im PDF-Format hoch. Die maximale Dateigröße beträgt 10 MB.",
        emailAddress: "E-Mail-Adresse",
        emailPlaceholder: "ihre.email@beispiel.de",
        addressCertificate: "Meldebescheinigung (Address Certificate)",
        landlordCertificate: "Wohnungsgeberbestätigung (Landlord Certificate)",
        dropFile: "Datei hier ablegen oder",
        browse: "durchsuchen",
        pdfOnly: "Nur PDF-Dateien (max. 10 MB)",
        readyToUpload: "Bereit zum Hochladen",
        submitApplication: "📤 ANTRAG EINREICHEN",
        processing: "Wird verarbeitet...",
        dataEncrypted: "Ihre Daten werden verschlüsselt übertragen und gemäß DSGVO verarbeitet.",
        // Sidebar
        requiredDocuments: "📋 Erforderliche Unterlagen",
        validId: "Gültiger Personalausweis oder Reisepass",
        landlordConfirmationDoc: "Wohnungsgeberbestätigung des Vermieters",
        completedForm: "Ausgefülltes Anmeldeformular",
        contactHelp: "📞 Kontakt & Hilfe",
        email: "E-Mail",
        phone: "Telefon",
        openingHours: "Öffnungszeiten",
        openingTime: "Mo-Fr: 8:00 - 16:00 Uhr",
        // Footer
        imprint: "Impressum",
        dataProtection: "Datenschutz",
        accessibility: "Barrierefreiheit",
        termsOfUse: "Nutzungsbedingungen",
        copyright: "© 2025 Bürgerportal - Alle Rechte vorbehalten",
        // Messages
        fillAllFields: "Bitte füllen Sie alle Pflichtfelder aus.",
        submitSuccess: "Ihr Antrag wurde erfolgreich eingereicht. Sie erhalten eine Bestätigung per E-Mail.",
        submitFailed: "Einreichung fehlgeschlagen. Bitte versuchen Sie es erneut.",
        // Chatbot
        chatbotTitle: "Bürger-Assistent",
        online: "● Online",
        chatPlaceholder: "Ihre Nachricht...",
        chatGreeting: "Guten Tag! 👋 Wie kann ich Ihnen bei Ihrer Anmeldung helfen?",
        chatError: "Entschuldigung, es gibt ein Verbindungsproblem. Bitte versuchen Sie es erneut.",
        goodbye: "Auf Wiedersehen! Bei Fragen stehen wir Ihnen gerne zur Verfügung.",
        // Contact Page
        contactTitle: "📞 Kontaktieren Sie uns",
        contactSubtitle: "Nehmen Sie Kontakt mit unserem Support-Team auf",
        yourName: "Ihr Name",
        namePlaceholder: "Geben Sie Ihren vollständigen Namen ein",
        subject: "Betreff",
        subjectPlaceholder: "Worum geht es?",
        message: "Nachricht",
        messagePlaceholder: "Schreiben Sie Ihre Nachricht hier...",
        sendMessage: "📤 NACHRICHT SENDEN",
        sending: "Wird gesendet...",
        messageSent: "Ihre Nachricht wurde erfolgreich gesendet!",
        messageFailed: "Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
        backToPortal: "← Zurück zum Portal"
    }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState(() => {
        // Check localStorage for saved preference
        const saved = localStorage.getItem('language');
        return saved || 'en';
    });

    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);

    const t = (key) => {
        return translations[language][key] || key;
    };

    const toggleLanguage = (lang) => {
        setLanguage(lang);
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
