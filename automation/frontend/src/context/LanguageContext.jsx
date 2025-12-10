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
    },
    // Turkish
    tr: {
        federalRepublic: "🇩🇪 Almanya Federal Cumhuriyeti",
        english: "English", german: "Deutsch", help: "Yardım", contact: "İletişim",
        citizenPortal: "Vatandaş Portalı", registrationOffice: "Nüfus Kayıt Ofisi - Kayıt",
        userPortal: "Kullanıcı Portalı", adminDashboard: "Yönetici Paneli", logout: "Çıkış",
        homepage: "Ana Sayfa", citizenServices: "Vatandaş Hizmetleri", addressChange: "Adres Değişikliği",
        registeringApartment: "📋 Daire Kaydı", registrationSubtitle: "İkamet Kaydı - Adres değişikliği için belgelerinizi gönderin",
        personalData: "Kişisel Bilgiler", emailAddress: "E-posta adresi", submitApplication: "📤 BAŞVURUYU GÖNDER",
        processing: "İşleniyor...", fillAllFields: "Lütfen tüm zorunlu alanları doldurun.",
        submitSuccess: "Başvurunuz başarıyla gönderildi.", submitFailed: "Gönderim başarısız. Lütfen tekrar deneyin.",
        chatbotTitle: "Vatandaş Asistanı", chatPlaceholder: "Mesajınız...",
        chatGreeting: "Merhaba! 👋 Adres değişikliğinizde size nasıl yardımcı olabilirim?"
    },
    // Arabic
    ar: {
        federalRepublic: "🇩🇪 جمهورية ألمانيا الاتحادية",
        english: "English", german: "Deutsch", help: "مساعدة", contact: "اتصل بنا",
        citizenPortal: "بوابة المواطن", registrationOffice: "مكتب التسجيل",
        userPortal: "بوابة المستخدم", adminDashboard: "لوحة الإدارة", logout: "تسجيل الخروج",
        homepage: "الصفحة الرئيسية", citizenServices: "خدمات المواطن", addressChange: "تغيير العنوان",
        registeringApartment: "📋 تسجيل شقة", registrationSubtitle: "تسجيل الإقامة - قدم مستنداتك لتغيير العنوان",
        personalData: "البيانات الشخصية", emailAddress: "البريد الإلكتروني", submitApplication: "📤 إرسال الطلب",
        processing: "جاري المعالجة...", fillAllFields: "يرجى ملء جميع الحقول المطلوبة.",
        submitSuccess: "تم تقديم طلبك بنجاح.", submitFailed: "فشل الإرسال. حاول مرة أخرى.",
        chatbotTitle: "مساعد المواطن", chatPlaceholder: "رسالتك...",
        chatGreeting: "مرحباً! 👋 كيف يمكنني مساعدتك في تغيير عنوانك اليوم؟"
    },
    // Polish
    pl: {
        federalRepublic: "🇩🇪 Republika Federalna Niemiec",
        english: "English", german: "Deutsch", help: "Pomoc", contact: "Kontakt",
        citizenPortal: "Portal Obywatela", registrationOffice: "Urząd Meldunkowy",
        userPortal: "Portal Użytkownika", adminDashboard: "Panel Administracyjny", logout: "Wyloguj",
        homepage: "Strona główna", citizenServices: "Usługi dla obywateli", addressChange: "Zmiana adresu",
        registeringApartment: "📋 Rejestracja mieszkania", registrationSubtitle: "Zameldowanie - Prześlij dokumenty do zmiany adresu",
        personalData: "Dane osobowe", emailAddress: "Adres e-mail", submitApplication: "📤 WYŚLIJ WNIOSEK",
        processing: "Przetwarzanie...", fillAllFields: "Proszę wypełnić wszystkie wymagane pola.",
        submitSuccess: "Twój wniosek został pomyślnie przesłany.", submitFailed: "Wysyłanie nie powiodło się.",
        chatbotTitle: "Asystent Obywatela", chatPlaceholder: "Twoja wiadomość...",
        chatGreeting: "Cześć! 👋 Jak mogę Ci pomóc w zmianie adresu?"
    },
    // Russian
    ru: {
        federalRepublic: "🇩🇪 Федеративная Республика Германия",
        english: "English", german: "Deutsch", help: "Помощь", contact: "Контакт",
        citizenPortal: "Портал гражданина", registrationOffice: "Бюро регистрации",
        userPortal: "Портал пользователя", adminDashboard: "Панель администратора", logout: "Выход",
        homepage: "Главная", citizenServices: "Услуги для граждан", addressChange: "Изменение адреса",
        registeringApartment: "📋 Регистрация квартиры", registrationSubtitle: "Регистрация по месту жительства",
        personalData: "Личные данные", emailAddress: "Эл. почта", submitApplication: "📤 ОТПРАВИТЬ ЗАЯВКУ",
        processing: "Обработка...", fillAllFields: "Пожалуйста, заполните все обязательные поля.",
        submitSuccess: "Ваша заявка успешно отправлена.", submitFailed: "Ошибка отправки.",
        chatbotTitle: "Помощник гражданина", chatPlaceholder: "Ваше сообщение...",
        chatGreeting: "Здравствуйте! 👋 Как я могу помочь вам с изменением адреса?"
    },
    // Spanish
    es: {
        federalRepublic: "🇩🇪 República Federal de Alemania",
        english: "English", german: "Deutsch", help: "Ayuda", contact: "Contacto",
        citizenPortal: "Portal del Ciudadano", registrationOffice: "Oficina de Registro",
        userPortal: "Portal de Usuario", adminDashboard: "Panel de Administración", logout: "Cerrar sesión",
        homepage: "Inicio", citizenServices: "Servicios al Ciudadano", addressChange: "Cambio de Dirección",
        registeringApartment: "📋 Registro de vivienda", registrationSubtitle: "Registro de residencia - Envíe sus documentos",
        personalData: "Datos Personales", emailAddress: "Correo electrónico", submitApplication: "📤 ENVIAR SOLICITUD",
        processing: "Procesando...", fillAllFields: "Por favor complete todos los campos requeridos.",
        submitSuccess: "Su solicitud ha sido enviada con éxito.", submitFailed: "Error al enviar.",
        chatbotTitle: "Asistente Ciudadano", chatPlaceholder: "Su mensaje...",
        chatGreeting: "¡Hola! 👋 ¿Cómo puedo ayudarte con tu cambio de dirección?"
    },
    // French
    fr: {
        federalRepublic: "🇩🇪 République fédérale d'Allemagne",
        english: "English", german: "Deutsch", help: "Aide", contact: "Contact",
        citizenPortal: "Portail Citoyen", registrationOffice: "Bureau d'enregistrement",
        userPortal: "Portail Utilisateur", adminDashboard: "Tableau de Bord Admin", logout: "Déconnexion",
        homepage: "Accueil", citizenServices: "Services aux Citoyens", addressChange: "Changement d'Adresse",
        registeringApartment: "📋 Enregistrement de logement", registrationSubtitle: "Déclaration de domicile",
        personalData: "Données Personnelles", emailAddress: "Adresse e-mail", submitApplication: "📤 ENVOYER LA DEMANDE",
        processing: "Traitement...", fillAllFields: "Veuillez remplir tous les champs requis.",
        submitSuccess: "Votre demande a été envoyée avec succès.", submitFailed: "Échec de l'envoi.",
        chatbotTitle: "Assistant Citoyen", chatPlaceholder: "Votre message...",
        chatGreeting: "Bonjour! 👋 Comment puis-je vous aider avec votre changement d'adresse?"
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
        // First try current language, then fallback to English, then show key
        if (translations[language] && translations[language][key]) {
            return translations[language][key];
        }
        return translations.en[key] || key;
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
