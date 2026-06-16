mot_de_passe ="python123"
nom_utilisateur = "admin"
tentatives = 5
while tentatives > 0:
    user = input("Entrez votre nom d'utilisateur: ")
    password = input("Entrez votre mot de passe: ")
    if user == nom_utilisateur and password == mot_de_passe:
        print("Connexion réussie! Bienvenue", nom_utilisateur)
        break
    else:
        tentatives -= 1
        print("Nom d'utilisateur ou mot de passe incorrect. Il vous reste", tentatives, "tentatives.")

if tentatives == 0:
    print("Accès refusé. Trop de tentatives échouées.")