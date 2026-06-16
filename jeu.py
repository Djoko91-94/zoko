import random
print("=== jeu : devinez le nombre ===")
nombre_secret = random.randint(1, 100)
essais_restants = 7
while essais_restants > 0:
    print("\nIl te reste", essais_restants, "essais")
    guess = int(input("Devine le nombre (entre 1 et 100): "))
    if guess == nombre_secret:
        print("Bravo! Tu as deviné le nombre secret !")
        break
    elif guess < nombre_secret:
        print("C'est plus grand!")
    else:       
        print("C'est plus petit!")
    essais_restants -= 1
if essais_restants == 0:
    print("perdu le nombre secret était", nombre_secret)