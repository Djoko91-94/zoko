utilisateurs = {}
while True:
    print("\n=== MENU ===")
    print("1. creer un compte")
    print("2. Se connecter")
    print("3. Quitter")
    print("4. Voir les comptes existants")
    print("5. Supprimer un compte")
    choix = input("Choisissez une option: ")
    if choix == "1":
        username = input("Entrez un nom d'utilisateur: ")
        if username in utilisateurs:
            print("Ce nom d'utilisateur existe déjà. Veuillez en choisir un autre.")
        else:
            password = input("Entrez un mot de passe: ")
            utilisateurs[username] = password
            print("Compte créé avec succès!")
    elif choix == "2":
        username = input("Entrez votre nom d'utilisateur: ")
        password = input("Entrez votre mot de passe: ")
        if username in utilisateurs and utilisateurs[username] == password:
            print("Connexion réussie! Bienvenue", username)
        else:
            print("Nom d'utilisateur ou mot de passe incorrect.")
    elif choix == "3":
        print("Au revoir!")
        break
    elif choix == "4":
        if len(utilisateurs) == 0:
            print("Aucun compte existant.")
        else:
            print("\nComptes existants:")
            for user in utilisateurs:
                print("-", user)
    elif choix == "5":
        username = input("Entrez le nom d'utilisateur du compte à supprimer: ")
        if username in utilisateurs:
            del utilisateurs[username]
            print("Compte supprimé avec succès.")
        else:
            print("Ce nom d'utilisateur n'existe pas.")
    else:
        print("Option invalide. Veuillez choisir une option valide.")