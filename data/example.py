from lightning import Lightning
from numpy import random

lgn = Lightning()

mat = random.randn(10,20)

lgn.matrix(mat, colormap="Purples")