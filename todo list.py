taches = []
while True:
    print("\n=== TODO List ===")
    print("1. Ajouter une tâche")
    print("2. Voir les tâches")
    print("3. Supprimer une tâche")
    print("4. Quitter")
    choix = input("Choisissez une option: ")
    if choix == "1":
        tache = input("Entrez la tâche à ajouter: ")
        taches.append(tache)
        print("Tâche ajoutée!")
    elif choix == "2":
        if len(taches) == 0:
            print("Aucune tâche dans la liste.")
        else:
            print("\nTes tâches:")
            for i in range(len(taches)):
                print(i, "-", taches[i])
    elif choix == "3":
        if len(taches) == 0:
            print("Aucune tâche à supprimer.")
        else:
            for i in range(len(taches)):
                print(i, "-", taches[i])
            index = int(input("Entrez le numéro de la tâche à supprimer: "))
            if 0 <= index < len(taches):
                taches.pop(index)
                print("Tâche supprimée!")
            else:
                print("Numéro invalide.")
    elif choix == "4":
        print("Au revoir!")
        break
    else:
        print("Option invalide. Veuillez réessayer.")